import { GoogleGenerativeAI } from '@google/generative-ai'

/**
 * IA Vision Service (Sprint 13)
 * Utiliza Google Gemini 1.5 Flash para extraer resultados de capturas de pantalla.
 */

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '')

export interface AIDetectionResult {
  teamName?: string
  killCount: number
  rank: number
  confidence: number
  rawText?: string
}

export async function analyzeSubmissionImage(
  imageBuffer: Buffer,
  mimeType: string
): Promise<AIDetectionResult | { error: string }> {
  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-pro',
      generationConfig: { responseMimeType: 'application/json' }
    })

    const prompt = `
      Eres un experto arbitro internacional de torneos de Gaming (Battle Royale como Warzone, Free Fire, Fortnite). 
      Tu tarea es analizar esta captura de pantalla de resultados finales con precisión quirúrgica.
      
      Extrae los siguientes datos:
      1. El nombre del equipo o jugador (busca campos como "Ganador", "Squad", o nombres en la tabla).
      2. El número de bajas (busca palabras como "KIlls", "Eliminaciones", "Bajas", "Eliminated").
      3. La posición final (busca "Rank", "Posición", "Top", "#", "Squad Placement").
      
      REGLAS CRÍTICAS:
      - Si hay varios números, prioriza el que claramente indique el total del equipo o del jugador que sube la prueba.
      - Si el texto es borroso, usa tu razonamiento contextual para determinar el número más probable.
      - Si no hay datos legibles, devuelve 0 y confianza baja.
      
      Retorna estrictamente este JSON:
      {
        "teamName": string,
        "killCount": number,
        "rank": number,
        "confidence": number (0.0 a 1.0)
      }
    `

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageBuffer.toString('base64'),
          mimeType,
        },
      },
    ])

    const response = await result.response
    const text = response.text()
    
    try {
      const parsed = JSON.parse(text)
      return {
        teamName: parsed.teamName,
        killCount: Number(parsed.killCount) || 0,
        rank: Number(parsed.rank) || 0,
        confidence: Number(parsed.confidence) || 0.5,
        rawText: text
      }
    } catch (e) {
      console.error('AI JSON Parse Error:', text)
      return { error: 'Formato de respuesta de IA inválido' }
    }
  } catch (error: any) {
    console.error('AI Vision Error:', error)
    return { error: error.message || 'Error desconocido al analizar la imagen' }
  }
}
