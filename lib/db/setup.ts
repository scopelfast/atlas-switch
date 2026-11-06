import { exec } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { promisify } from 'node:util';
import readline from 'node:readline';
import crypto from 'node:crypto';
import path from 'node:path';
import os from 'node:os';

const execAsync = promisify(exec);

function question(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans);
    })
  );
}

async function checkStripeCLI() {
  console.log(
    'Etapa 1: Verificando se a Stripe CLI está instalada e autenticada...'
  );
  try {
    await execAsync('stripe --version');
    console.log('Stripe CLI instalada.');

    // Check if Stripe CLI is authenticated
    try {
      await execAsync('stripe config --list');
      console.log('Stripe CLI autenticada.');
    } catch (error) {
      console.log(
        'Stripe CLI não está autenticada ou a autenticação expirou.'
      );
      console.log('Execute: stripe login');
      const answer = await question(
        'Você concluiu a autenticação? (s/n): '
      );
      const normalizedAnswer = answer.trim().toLowerCase();
      if (!['s', 'y'].includes(normalizedAnswer)) {
        console.log(
          'Autentique a Stripe CLI e execute este script novamente.'
        );
        process.exit(1);
      }

      // Verify authentication after user confirms login
      try {
        await execAsync('stripe config --list');
        console.log('Autenticação da Stripe CLI confirmada.');
      } catch (error) {
        console.error(
          'Falha ao verificar a autenticação da Stripe CLI. Tente novamente.'
        );
        process.exit(1);
      }
    }
  } catch (error) {
    console.error(
      'Stripe CLI não está instalada. Instale e tente novamente.'
    );
    console.log('Para instalar a Stripe CLI, siga estes passos:');
    console.log('1. Acesse: https://docs.stripe.com/stripe-cli');
    console.log(
      '2. Baixe e instale a Stripe CLI para seu sistema operacional'
    );
    console.log('3. Após instalar, execute: stripe login');
    console.log(
      'Após instalar e autenticar, execute este script novamente.'
    );
    process.exit(1);
  }
}

async function getPostgresURL(): Promise<string> {
  console.log('Etapa 2: Configurando Postgres');
  const dbChoice = await question(
    'Deseja usar Postgres local via Docker (L) ou remoto (R)? (L/R): '
  );

  if (dbChoice.toLowerCase() === 'l') {
    console.log('Configurando Postgres local com Docker...');
    await setupLocalPostgres();
    return 'postgres://postgres:postgres@localhost:54322/postgres';
  } else {
    console.log(
      'Você pode obter Postgres em: https://vercel.com/marketplace?category=databases'
    );
    return await question('Digite sua POSTGRES_URL: ');
  }
}

async function setupLocalPostgres() {
  console.log('Verificando se o Docker está instalado...');
  try {
    await execAsync('docker --version');
    console.log('Docker instalado.');
  } catch (error) {
    console.error(
      'Docker não está instalado. Instale e tente novamente.'
    );
    console.log(
      'Para instalar, acesse: https://docs.docker.com/get-docker/'
    );
    process.exit(1);
  }

  console.log('Criando arquivo docker-compose.yml...');
  const dockerComposeContent = `
services:
  postgres:
    image: postgres:16.4-alpine
    container_name: next_saas_starter_postgres
    environment:
      POSTGRES_DB: postgres
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "54322:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
`;

  await fs.writeFile(
    path.join(process.cwd(), 'docker-compose.yml'),
    dockerComposeContent
  );
  console.log('Arquivo docker-compose.yml criado.');

  console.log('Iniciando container com `docker compose up -d`...');
  try {
    await execAsync('docker compose up -d');
    console.log('Container Docker iniciado com sucesso.');
  } catch (error) {
    console.error(
      'Falha ao iniciar o container Docker. Verifique sua instalação e tente novamente.'
    );
    process.exit(1);
  }
}

async function getStripeSecretKey(): Promise<string> {
  console.log('Etapa 3: Obtendo Stripe Secret Key');
  console.log(
    'Você encontra sua Stripe Secret Key em: https://dashboard.stripe.com/test/apikeys'
  );
  return await question('Digite sua Stripe Secret Key: ');
}

async function createStripeWebhook(): Promise<string> {
  console.log('Etapa 4: Criando webhook do Stripe...');
  try {
    const { stdout } = await execAsync('stripe listen --print-secret');
    const match = stdout.match(/whsec_[a-zA-Z0-9]+/);
    if (!match) {
      throw new Error('Falha ao obter o segredo do webhook');
    }
    console.log('Webhook do Stripe criado.');
    return match[0];
  } catch (error) {
    console.error(
      'Falha ao criar webhook do Stripe. Verifique a instalação e permissões da Stripe CLI.'
    );
    if (os.platform() === 'win32') {
      console.log(
        'Observação: no Windows, talvez seja necessário executar como administrador.'
      );
    }
    throw error;
  }
}

function generateAuthSecret(): string {
  console.log('Etapa 5: Gerando AUTH_SECRET...');
  return crypto.randomBytes(32).toString('hex');
}

async function writeEnvFile(envVars: Record<string, string>) {
  console.log('Etapa 6: Gravando variáveis no .env');
  const envContent = Object.entries(envVars)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  await fs.writeFile(path.join(process.cwd(), '.env'), envContent);
  console.log('Arquivo .env criado com as variáveis necessárias.');
}

async function main() {
  await checkStripeCLI();

  const POSTGRES_URL = await getPostgresURL();
  const STRIPE_SECRET_KEY = await getStripeSecretKey();
  const STRIPE_WEBHOOK_SECRET = await createStripeWebhook();
  const BASE_URL = 'http://localhost:3003';
  const AUTH_SECRET = generateAuthSecret();

  await writeEnvFile({
    POSTGRES_URL,
    STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET,
    BASE_URL,
    AUTH_SECRET,
  });

  console.log('🎉 Setup concluído com sucesso!');
}

main().catch(console.error);
