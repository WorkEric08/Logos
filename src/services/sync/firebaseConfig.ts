// Configuração do app WEB do Firebase (projeto logos-f9d33, app "Treino BB web"). Estes valores são PÚBLICOS por desenho: identificam o projeto e vão no
// código do navegador de qualquer jeito. Quem protege os dados são as regras do Firestore (firestore.rules) e o login, não segredo nenhum aqui.
// NUNCA colocar aqui chave de administrador, conta de serviço ou token. No Android o app usa o google-services.json (android/app).
export const firebaseConfig = {
  "apiKey": "AIzaSyD86mNvnre0RdKxnETwWCK0p3I9KIsZP14",
  "authDomain": "logos-f9d33.firebaseapp.com",
  "projectId": "logos-f9d33",
  "storageBucket": "logos-f9d33.firebasestorage.app",
  "messagingSenderId": "364895773280",
  "appId": "1:364895773280:web:6ae35b622bcfe4321a1905"
} as const
