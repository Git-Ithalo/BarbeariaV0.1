// Conteúdo compartilhado: fotos (Pexels, licença gratuita, sem necessidade de atribuição)
// e textos descritivos usados nas páginas de Início, Serviços, Equipe e Área do Cliente.
function px(id, w) { return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w||800}`; }

const CONTENT = {
  heroImage: px(7518728, 1600),
  storefrontImage: px(2318055, 1000),
  gallery: [
    { id: 2318055, alt: 'Ambiente interno da barbearia' },
    { id: 13809242, alt: 'Mesa de ferramentas do barbeiro' },
    { id: 1836983, alt: 'Barbeiro cortando o cabelo de um cliente' },
    { id: 11793730, alt: 'Máquinas de corte profissionais' }
  ],
  barbersByName: {
    'Marcos Silva': { photo: px(15946547, 500), specialty: 'Cortes clássicos e degradê', years: 9, instagram: '@marcos.barbeiro' },
    'Rafael Costa': { photo: px(7781848, 500), specialty: 'Barba e navalha', years: 12, instagram: '@rafa.navalha' },
    'Diego Alves': { photo: px(18483778, 500), specialty: 'Cortes modernos e coloração', years: 6, instagram: '@diego.cortes' }
  },
  barberFallback: { photo: px(5282408, 500), specialty: 'Barbeiro profissional', years: 5, instagram: '' },
  servicesByName: {
    'Corte de Cabelo': { image: px(1836983, 700), desc: 'Corte personalizado com acabamento na navalha, lavagem e finalização com produtos premium.' },
    'Barba Completa': { image: px(3998417, 700), desc: 'Modelagem completa da barba com toalha quente, óleos e alinhamento na navalha.' },
    'Corte + Barba': { image: px(7697433, 700), desc: 'O combo completo: corte e barba no mesmo atendimento, com desconto especial no tempo.' },
    'Sobrancelha': { image: px(5282408, 700), desc: 'Design e alinhamento de sobrancelha na navalha ou pinça, rápido e preciso.' },
    'Pigmentação': { image: px(6007395, 700), desc: 'Pigmentação para disfarçar falhas ou cobrir fios brancos, com produtos dermatologicamente testados.' },
    'Corte Infantil': { image: px(7697356, 700), desc: 'Corte especial para os pequenos, em um ambiente tranquilo e paciente, com nossos barbeiros mais experientes.' }
  },
  serviceFallback: { image: px(13809242, 700), desc: 'Atendimento profissional realizado com todo o cuidado pela nossa equipe.' }
};

function serviceInfo(name) { return CONTENT.servicesByName[name] || CONTENT.serviceFallback; }
function barberInfo(name) { return CONTENT.barbersByName[name] || CONTENT.barberFallback; }
