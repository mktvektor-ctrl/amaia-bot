const { google } = require('googleapis');
const readline = require('readline');

const CLIENT_ID = '616193131383-dpgijkvnrk4q1jv8k3pu2j7vkk8lmvt5.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URI = 'http://localhost:3000/auth/callback';

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const url = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/calendar'],
  prompt: 'consent'
});

console.log('\n👉 Abre esta URL en el navegador:\n', url);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('\nPega aquí el código que te da Google: ', async (code) => {
  const { tokens } = await oauth2Client.getToken(code);
  console.log('\n✅ TOKEN DE REFRESCO:\n', tokens.refresh_token);
  console.log('\nGuárdalo, lo necesitarás en Railway.');
  rl.close();
});