'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Helper to check if user is admin
async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'SUPER_ADMIN' || profile?.role === 'ADMIN') {
    return user
  }
  return null
}

// 1. Create Prediction Market (Admin only)
export async function createPredictionMarketAction(input: {
  tournamentId: string
  matchId?: string
  gameType: string
  marketType: string
  question: string
  options: { id: string; name: string; odds: number }[]
}) {
  try {
    const admin = await getAdminUser()
    if (!admin) return { error: 'No autorizado' }

    const adminSupabase = await createAdminClient()
    const { data, error } = await adminSupabase
      .from('bet_markets')
      .insert({
        tournament_id: input.tournamentId,
        match_id: input.matchId || null,
        game_type: input.gameType,
        market_type: input.marketType,
        question: input.question,
        options: input.options,
        status: 'open'
      })
      .select()
      .single()

    if (error) return { error: error.message }

    revalidatePath(`/admin/bets`)
    revalidatePath(`/t/[slug]`)
    return { success: true, data }
  } catch (err: any) {
    return { error: err.message || 'Error al crear el mercado de apuestas' }
  }
}

// 2. Close Prediction Market (Admin only) - Stops accepting new bets
export async function closePredictionMarketAction(marketId: string) {
  try {
    const admin = await getAdminUser()
    if (!admin) return { error: 'No autorizado' }

    const adminSupabase = await createAdminClient()
    const { error } = await adminSupabase
      .from('bet_markets')
      .update({ status: 'closed' })
      .eq('id', marketId)

    if (error) return { error: error.message }

    revalidatePath(`/admin/bets`)
    revalidatePath(`/t/[slug]`)
    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Error al cerrar el mercado de apuestas' }
  }
}

// 3. Place Bet (Authenticated user)
export async function placePredictionAction(input: {
  marketId: string
  selectedOptionId: string
  amount: number
}) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const amount = parseFloat(input.amount as any)
    if (isNaN(amount) || amount <= 0) {
      return { error: 'Monto de apuesta inválido' }
    }

    const adminSupabase = await createAdminClient()

    // Retrieve market details and check status
    const { data: market, error: marketErr } = await adminSupabase
      .from('bet_markets')
      .select('*')
      .eq('id', input.marketId)
      .single()

    if (marketErr || !market) return { error: 'Mercado de apuestas no encontrado' }
    if (market.status !== 'open') return { error: 'Las apuestas para este mercado están cerradas' }

    // Enforce sequential betting: locked if linked to match N > 1 and match N-1 is not completed
    if (market.match_id) {
      const { data: currentMatch } = await adminSupabase
        .from('matches')
        .select('match_number, tournament_id')
        .eq('id', market.match_id)
        .single()

      if (currentMatch && currentMatch.match_number > 1) {
        const { data: prevMatch } = await adminSupabase
          .from('matches')
          .select('is_completed')
          .eq('tournament_id', currentMatch.tournament_id)
          .eq('match_number', currentMatch.match_number - 1)
          .maybeSingle()

        if (prevMatch && !prevMatch.is_completed) {
          return { error: 'Esta apuesta se habilitará cuando finalice la partida anterior.' }
        }
      }
    }

    // Find option and lock the odds
    const option = (market.options as any[]).find((opt) => opt.id === input.selectedOptionId)
    if (!option) return { error: 'Opción de apuesta seleccionada inválida' }

    const odds = parseFloat(option.odds)
    const potentialPayout = amount * odds

    // Fetch user profile balance
    const { data: profile, error: profileErr } = await adminSupabase
      .from('profiles')
      .select('balance')
      .eq('id', user.id)
      .single()

    if (profileErr || !profile) return { error: 'No se pudo obtener el perfil de usuario' }
    const currentBalance = parseFloat(profile.balance || '0.00')

    if (currentBalance < amount) {
      return { error: 'Saldo insuficiente en tu billetera de K-Coins' }
    }

    const newBalance = currentBalance - amount

    // Deduct balance and register bet
    const { error: balanceErr } = await adminSupabase
      .from('profiles')
      .update({ balance: newBalance })
      .eq('id', user.id)

    if (balanceErr) return { error: 'Error al procesar el cobro de la apuesta' }

    const { data: bet, error: betErr } = await adminSupabase
      .from('user_bets')
      .insert({
        market_id: input.marketId,
        user_id: user.id,
        selected_option_id: input.selectedOptionId,
        amount,
        odds,
        potential_payout: potentialPayout,
        status: 'pending'
      })
      .select()
      .single()

    if (betErr) {
      // Rollback balance update in case of insert error
      await adminSupabase.from('profiles').update({ balance: currentBalance }).eq('id', user.id)
      return { error: 'Error al registrar la apuesta' }
    }

    // Write coin transaction audit log
    await adminSupabase.from('coin_transactions').insert({
      user_id: user.id,
      amount: -amount,
      type: 'bet_placed',
      reference_id: bet.id
    })

    revalidatePath(`/t/[slug]`)
    return { success: true, balance: newBalance, bet }
  } catch (err: any) {
    return { error: err.message || 'Error al colocar la predicción' }
  }
}

// 4. Resolve Prediction Market (Admin only)
export async function resolvePredictionMarketAction(marketId: string, winningOptionId: string) {
  try {
    const admin = await getAdminUser()
    if (!admin) return { error: 'No autorizado' }

    const adminSupabase = await createAdminClient()

    // Fetch market details
    const { data: market, error: marketErr } = await adminSupabase
      .from('bet_markets')
      .select('*')
      .eq('id', marketId)
      .single()

    if (marketErr || !market) return { error: 'Mercado no encontrado' }
    if (market.status === 'resolved') return { error: 'El mercado ya fue resuelto previamente' }

    // Update market status and winner
    const { error: resolveErr } = await adminSupabase
      .from('bet_markets')
      .update({
        status: 'resolved',
        winning_option_id: winningOptionId
      })
      .eq('id', marketId)

    if (resolveErr) return { error: resolveErr.message }

    // Fetch all pending bets for this market
    const { data: bets, error: betsErr } = await adminSupabase
      .from('user_bets')
      .select('*')
      .eq('market_id', marketId)
      .eq('status', 'pending')

    if (betsErr) return { error: 'Error al buscar apuestas de los usuarios' }

    // Process bets (credit winners, mark losers)
    for (const bet of (bets || [])) {
      const isWinner = bet.selected_option_id === winningOptionId
      const status = isWinner ? 'won' : 'lost'

      // Update bet status
      await adminSupabase
        .from('user_bets')
        .update({ status })
        .eq('id', bet.id)

      if (isWinner) {
        const winAmount = parseFloat(bet.potential_payout)

        // Fetch user's current balance
        const { data: userProfile } = await adminSupabase
          .from('profiles')
          .select('balance')
          .eq('id', bet.user_id)
          .single()

        if (userProfile) {
          const currentBalance = parseFloat(userProfile.balance || '0.00')
          const newBalance = currentBalance + winAmount

          // Credit balance
          await adminSupabase
            .from('profiles')
            .update({ balance: newBalance })
            .eq('id', bet.user_id)

          // Log transaction
          await adminSupabase.from('coin_transactions').insert({
            user_id: bet.user_id,
            amount: winAmount,
            type: 'bet_won',
            reference_id: bet.id
          })
        }
      }
    }

    revalidatePath(`/admin/bets`)
    revalidatePath(`/t/[slug]`)
    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Error al resolver el mercado de apuestas' }
  }
}

// 5. Cancel and Refund Prediction Market (Admin only)
export async function cancelPredictionMarketAction(marketId: string) {
  try {
    const admin = await getAdminUser()
    if (!admin) return { error: 'No autorizado' }

    const adminSupabase = await createAdminClient()

    // Fetch market details
    const { data: market, error: marketErr } = await adminSupabase
      .from('bet_markets')
      .select('*')
      .eq('id', marketId)
      .single()

    if (marketErr || !market) return { error: 'Mercado no encontrado' }
    if (market.status === 'resolved') return { error: 'No se puede cancelar un mercado ya resuelto' }

    // Update market status
    const { error: resolveErr } = await adminSupabase
      .from('bet_markets')
      .update({ status: 'cancelled' })
      .eq('id', marketId)

    if (resolveErr) return { error: resolveErr.message }

    // Fetch all pending/active bets
    const { data: bets } = await adminSupabase
      .from('user_bets')
      .select('*')
      .eq('market_id', marketId)
      .eq('status', 'pending')

    // Process refunds
    for (const bet of (bets || [])) {
      const refundAmount = parseFloat(bet.amount)

      await adminSupabase
        .from('user_bets')
        .update({ status: 'refunded' })
        .eq('id', bet.id)

      // Refund balance to user
      const { data: userProfile } = await adminSupabase
        .from('profiles')
        .select('balance')
        .eq('id', bet.user_id)
        .single()

      if (userProfile) {
        const currentBalance = parseFloat(userProfile.balance || '0.00')
        const newBalance = currentBalance + refundAmount

        await adminSupabase
          .from('profiles')
          .update({ balance: newBalance })
          .eq('id', bet.user_id)

        // Log transaction
        await adminSupabase.from('coin_transactions').insert({
          user_id: bet.user_id,
          amount: refundAmount,
          type: 'bet_refunded',
          reference_id: bet.id
        })
      }
    }

    revalidatePath(`/admin/bets`)
    revalidatePath(`/t/[slug]`)
    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Error al cancelar el mercado' }
  }
}

// 6. Auto-resolve markets for a match when it's marked as completed
export async function autoResolveMatchMarketsAction(matchId: string) {
  try {
    const adminSupabase = await createAdminClient()

    // Fetch open/closed markets linked to this match
    const { data: markets } = await adminSupabase
      .from('bet_markets')
      .select('*')
      .eq('match_id', matchId)
      .in('status', ['open', 'closed'])

    if (!markets || markets.length === 0) return { success: true, resolved: 0 }

    // Fetch approved submissions for this match
    const { data: submissions } = await adminSupabase
      .from('submissions')
      .select('id, team_id, rank, kill_count, player_kills, participant_id')
      .eq('match_id', matchId)
      .eq('status', 'approved')

    if (!submissions || submissions.length === 0) return { success: true, resolved: 0 }

    let resolved = 0

    for (const market of markets) {
      const options = market.options as { id: string; name: string; odds: number }[]
      let winningOptionId: string | null = null

      if (market.market_type === 'winner') {
        // Winner = submission with rank = 1 (lowest rank wins)
        const winner = submissions.reduce((best: any, s: any) =>
          s.rank != null && (best === null || s.rank < best.rank) ? s : best, null)
        if (winner) {
          // Match winning team to an option by team name substring
          const { data: winnerTeam } = await adminSupabase
            .from('teams')
            .select('name')
            .eq('id', winner.team_id)
            .single()
          if (winnerTeam) {
            const matched = options.find(opt =>
              opt.name.toLowerCase().includes(winnerTeam.name.toLowerCase()) ||
              winnerTeam.name.toLowerCase().includes(opt.name.toLowerCase())
            )
            if (matched) winningOptionId = matched.id
          }
        }
      } else if (market.market_type === 'most_kills') {
        // Most kills by team
        const topKillTeam = submissions.reduce((best: any, s: any) =>
          s.kill_count != null && (best === null || s.kill_count > best.kill_count) ? s : best, null)
        if (topKillTeam) {
          const { data: topTeam } = await adminSupabase
            .from('teams')
            .select('name')
            .eq('id', topKillTeam.team_id)
            .single()
          if (topTeam) {
            const matched = options.find(opt =>
              opt.name.toLowerCase().includes(topTeam.name.toLowerCase()) ||
              topTeam.name.toLowerCase().includes(opt.name.toLowerCase())
            )
            if (matched) winningOptionId = matched.id
          }
        }
      }

      if (!winningOptionId) continue

      // Close and resolve the market
      await adminSupabase.from('bet_markets').update({
        status: 'resolved',
        winning_option_id: winningOptionId,
      }).eq('id', market.id)

      // Pay out winners
      const { data: bets } = await adminSupabase
        .from('user_bets')
        .select('*')
        .eq('market_id', market.id)
        .eq('status', 'pending')

      for (const bet of (bets || [])) {
        const isWinner = bet.selected_option_id === winningOptionId
        const status = isWinner ? 'won' : 'lost'
        await adminSupabase.from('user_bets').update({ status }).eq('id', bet.id)

        if (isWinner) {
          const winAmount = parseFloat(bet.potential_payout)
          const { data: userProfile } = await adminSupabase
            .from('profiles').select('balance').eq('id', bet.user_id).single()
          if (userProfile) {
            const newBalance = parseFloat(userProfile.balance || '0.00') + winAmount
            await adminSupabase.from('profiles').update({ balance: newBalance }).eq('id', bet.user_id)
            await adminSupabase.from('coin_transactions').insert({
              user_id: bet.user_id,
              amount: winAmount,
              type: 'bet_won',
              reference_id: bet.id,
            })
          }
        }
      }

      resolved++
    }

    revalidatePath(`/admin/bets`)
    revalidatePath(`/t/[slug]`)
    return { success: true, resolved }
  } catch (err: any) {
    return { error: err.message || 'Error en auto-resolución de mercados' }
  }
}
