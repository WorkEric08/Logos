// O módulo do Snowball (português) vem sem tipos: só o que usamos.
declare module 'snowball-stemmers-js/lib/portuguese-stemmer.js' {
  export default class PortugueseStemmer { stemWord(palavra: string): string }
}
