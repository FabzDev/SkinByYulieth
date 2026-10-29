import readline from 'node:readline'
import { loadConfig } from '../config'
import { closeDatabase, openDatabase } from '../db'
import { hashPassword, validatePasswordStrength } from '../auth'
import { emailSchema, nameSchema } from '../validation'
import { nowBogota } from '../../shared/dates'

function createPrompt() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  })

  const ask = (question: string): Promise<string> =>
    new Promise((resolve) => {
      rl.question(question, (answer) => resolve(answer.trim()))
    })

  const askHidden = (question: string): Promise<string> =>
    new Promise((resolve) => {
      process.stdout.write(question)
      const mutable = rl as unknown as {
        _writeToOutput: (text: string) => void
        stdoutMuted?: boolean
      }
      const original = mutable._writeToOutput.bind(rl)
      mutable.stdoutMuted = true
      mutable._writeToOutput = (text: string) => {
        if (text.includes('\n') || text.includes('\r')) {
          mutable.stdoutMuted = false
          original('\n')
        } else {
          process.stdout.write('*')
        }
      }
      rl.question('', (answer) => {
        mutable._writeToOutput = original
        mutable.stdoutMuted = false
        resolve(answer)
      })
    })

  return { rl, ask, askHidden }
}

async function main(): Promise<void> {
  const config = loadConfig()
  const db = openDatabase(config.databasePath)
  const { rl, ask, askHidden } = createPrompt()

  try {
    console.log('\nCrear una cuenta para SkinByYulieth')
    console.log('Las contraseñas se guardan cifradas y nunca se muestran.\n')

    const rawName = await ask('Nombre: ')
    const name = nameSchema.parse(rawName)
    const rawEmail = await ask('Correo: ')
    const email = emailSchema.parse(rawEmail)

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as
      | { id: number }
      | undefined
    if (existing) {
      console.error(`\nYa existe una cuenta con el correo ${email}.`)
      process.exitCode = 1
      return
    }

    const password = await askHidden('Contraseña (mínimo 10 caracteres, letras y números): ')
    const problem = validatePasswordStrength(password)
    if (problem) {
      console.error(`\n${problem}`)
      process.exitCode = 1
      return
    }
    const confirmation = await askHidden('Confirmar contraseña: ')
    if (password !== confirmation) {
      console.error('\nLas contraseñas no coinciden.')
      process.exitCode = 1
      return
    }

    const passwordHash = await hashPassword(password, 12)
    const now = nowBogota()
    db.prepare(
      'INSERT INTO users (name, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    ).run(name, email, passwordHash, now, now)

    console.log(`\nCuenta creada para ${name} (${email}).`)
    console.log('Ya puedes iniciar sesión en la aplicación.\n')
  } finally {
    rl.close()
    closeDatabase(db)
  }
}

main().catch((error) => {
  console.error('\nNo se pudo crear la cuenta:', error instanceof Error ? error.message : error)
  process.exit(1)
})
