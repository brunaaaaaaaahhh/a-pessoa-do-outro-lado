// Character archive. Every fact here comes from the story text or its widgets.
// `match`: words that find the character in a chapter (first appearance and chapter count).
// `img`: the avatar the author used for the character in the MSN widgets.
window.CHARS = {
  leads: [
    {
      id: 'lorena', name: 'Lorena Ferette', aka: ['Lore', 'lore lispector'],
      role: 'Estudante de Letras na USP · popular no Tumblr',
      img: 'img/be08648b98b51dd0.jpg', match: ['Lorena', 'Lore 🌹', 'Lore Lispector', 'lore lispector'],
      msn: { nick: 'Lore 🌹', email: 'lorestevesf@msn.com', msg: 'Liberdade é pouco. O que desejo ainda não tem nome.' },
      about: [
        'Uma das garotas mais populares do Tumblr, onde assina como “lore lispector”. Estuda Letras na USP e é apaixonada por Clarice Lispector: a frase da autora está no seu MSN e no topo do seu Tumblr.',
        'É filha de Zenilda e Santiago Ferette, de uma das famílias mais influentes de São Paulo. Tem olhos verdes, sardas e uma paixão secreta por consultoria de moda. A história começa quando a hacker Trinity invade a conta dela por engano.',
      ],
      facts: [['Aniversário', '18 de maio'], ['Melhor amigo', 'Zé Maria, desde a infância'], ['Gosta de', 'Clarice Lispector, moda e, aos poucos, videogame']],
    },
    {
      id: 'eduarda', name: 'Eduarda “Juquinha” Fragoso', aka: ['Duda', 'Trinity'],
      role: 'Estudante de computação · a hacker Trinity',
      img: 'img/25ef1ac1f340eb97.jpg', alt: 'img/7725995f89925b60.jpg', match: ['Eduarda', 'Duda', 'Trinity', 'Tr!n!ty'],
      msn: { nick: '•._.••´¯“•.¸¸.•` Tr!n!ty `•.¸¸.•´´¯`••._.•', email: 'trinity3799@msn.com', msg: '.' },
      about: [
        'Sob o pseudônimo de Trinity, invade sistemas, adultera informações e rouba senhas, sempre pelo preço certo. Estuda computação, faz estágio no setor de TI da faculdade e é praticamente a única mulher da turma.',
        'Ruiva de olhos castanhos, anda de moto e ama videogame: a computação virou paixão no dia em que ganhou o primeiro console dos pais. É filha de Henrique e Violeta Fragoso. Para Paulinho, é “Juquinha”. Para os amigos novos, é Duda.',
      ],
      facts: [['MSN pessoal', 'duda 🌙 · fragduda37@msn.com'], ['Transporte', 'uma moto'], ['Gosta de', 'videogame e computadores']],
    },
  ],
};
