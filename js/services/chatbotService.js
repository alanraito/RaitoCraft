/*
  Arquivo: chatbotService.js
  Descrição: Este módulo é responsável por toda a lógica de interação com a API do Gemini
  e por orquestrar as chamadas para APIs externas (RaitoCraft e PokeAPI) com base nas
  solicitações do modelo de linguagem. Ele define um conjunto abrangente e detalhado de
  ferramentas (funções) que o Gemini pode chamar para responder a uma vasta gama de
  perguntas sobre receitas de craft, materiais, lucratividade, possibilidades de fabricação,
  sumário de uso de materiais, e informações detalhadas de Pokémon, como evoluções,
  efetividade de tipos e detalhes de habilidades. O módulo processa as respostas das APIs e gerencia
  o histórico da conversa, incluindo instruções específicas no prompt do sistema para garantir
  que as respostas do chatbot sejam autônomas, diretas, concisas, bem formatadas (usando Markdown
  para listas hierárquicas e ênfase clara, que será renderizado no chat), e que lidem
  adequadamente com dados vazios ou erros de API, sempre focando na clareza para o usuário.
  Principais Funções:
  - initChatbot: Inicializa o chatbot, configurando a API Key do Gemini e o prompt do sistema com diretrizes de comportamento e formatação de resposta.
  - sendMessageToGemini: Envia a mensagem do usuário para o Gemini, incluindo o histórico
                         e as ferramentas disponíveis, e processa a resposta de forma autônoma.
  - callApiFunction: Executa a chamada para a API backend do RaitoCraft ou PokeAPI quando
                     solicitado pelo Gemini através de uma function call. Retorna uma estrutura
                     padronizada indicando sucesso ou falha e os dados ou erro correspondente.
  Variáveis Globais:
  - generativeModel: Instância do modelo generativo do Gemini.
  - chat: Instância da sessão de chat com o Gemini, mantendo o histórico.
  - API_KEY: Chave da API do Google AI Studio (Gemini).
  - RAITOCRAFT_API_BASE_URL: URL base da API backend do RaitoCraft.
  - POKEAPI_BASE_URL: URL base da PokeAPI.
*/

const API_KEY = 'AIzaSyDWUmg0Q2weO3aXf3ivmHFbNmLZAtwEj0Q'; // Substitua pela sua API Key real
const RAITOCRAFT_API_BASE_URL = 'https://apiraitocraft-07k1.onrender.com/api';
const POKEAPI_BASE_URL = 'https://pokeapi.co/api/v2';

let generativeModel;
let chat;

const tools = [
  {
    functionDeclarations: [
      {
        name: 'getRecipeByName',
        description: "Obtém os detalhes completos de uma receita de craft, incluindo nome do item produzido, quantidade produzida, preço de venda NPC do item final, e a lista de todos os seus materiais (com nome do material, quantidade necessária, tipo do material e preço NPC de referência do material). Essencial para perguntas como 'Quais são os materiais para fazer [nome do item]?', 'Como faço [nome do item]?', 'Qual a receita detalhada de [nome do item]?', 'Mostre-me os ingredientes para [nome do item]', 'Detalhes da receita do [nome do item]', ou 'Que itens eu preciso para criar [nome do item]?'.",
        parameters: {
          type: 'OBJECT',
          properties: {
            itemName: {
              type: 'STRING',
              description: 'O nome exato do item cuja receita (incluindo materiais) deve ser buscada (ex: "Beast Ball", "Hyper Potion"). A busca não diferencia maiúsculas/minúsculas.'
            }
          },
          required: ['itemName']
        }
      },
      {
        name: 'findCraftsByMaterial',
        description: 'Busca e retorna uma lista de todos os itens de craft (receitas) que utilizam um material específico em sua composição. A resposta inclui os detalhes dos itens finais que podem ser feitos. Ideal para responder perguntas como "O que posso fazer com [nome do material]?", "Quais crafts usam [nome do material] como ingrediente?", "Para que serve o material [nome do material] na fabricação de itens?", "Liste receitas que contêm [nome do material]", ou "Quais itens são feitos com [nome do material]?".',
        parameters: {
          type: 'OBJECT',
          properties: {
            materialName: {
              type: 'STRING',
              description: 'O nome exato do material a ser pesquisado (ex: "Ice Crystal", "Dragon Scale", "Herb"). A busca não diferencia maiúsculas/minúsculas.'
            }
          },
          required: ['materialName']
        }
      },
      {
        name: 'getItemNpcSellPrice',
        description: "Obtém o preço de venda para NPC de um item craftável específico (o item final, não seus materiais). Útil para perguntas como 'Quanto o NPC paga por [NomeDoItem]?', 'Qual o valor de [NomeDoItem] se eu vender no NPC?', 'Preço de venda NPC do [NomeDoItem]', ou 'Qual o npc_sell_price de [NomeDoItem]?'.",
        parameters: {
          type: 'OBJECT',
          properties: {
            itemName: {
              type: 'STRING',
              description: 'O nome exato do item cujo preço de venda NPC deve ser buscado (ex: "Potion", "Great Ball"). A busca não diferencia maiúsculas/minúsculas.'
            }
          },
          required: ['itemName']
        }
      },
      {
        name: 'listAllCraftableItems',
        description: "Lista os nomes dos itens que podem ser criados (craftados) e a quantidade produzida por receita. Útil para perguntas como 'Quais são todos os itens craftáveis?', 'Mostre-me a lista de todos os crafts disponíveis', 'Que itens posso fabricar no jogo?', 'Quais receitas existem?', ou 'Liste todos os nomes de receitas'. A resposta pode ser limitada aos primeiros itens se a lista for muito longa, informando o total de itens existentes e quantos estão sendo mostrados.",
        parameters: {
          type: 'OBJECT',
          properties: {
            maxItemsToShow: {
              type: 'NUMBER',
              description: 'Número máximo de nomes de itens a serem retornados na lista. Padrão é 15 se não especificado pelo usuário ou se a pergunta não implicar um limite.'
            }
          }
        }
      },
      {
        name: 'getMostProfitableItemsByNpcPrice',
        description: 'Calcula e retorna uma lista dos itens de craft mais lucrativos para fabricar, considerando que todos os materiais são obtidos ou avaliados por seus preços de NPC e o item final é vendido também pelo preço de NPC. Os itens são listados do mais lucrativo para o menos. Útil para perguntas como "Qual item dá mais lucro vendendo pra NPC?", "O que compensa mais fazer e vender no NPC?", "Quais os crafts mais rentáveis baseados em preços de NPC?", "Ranking de lucratividade NPC dos crafts", ou "Qual o melhor item para farmar dinheiro via NPC?".',
        parameters: { type: 'OBJECT', properties: {} }
      },
      {
        name: 'filterItemsByMaterialProfile',
        description: 'Filtra e retorna itens de craft com base no perfil de tipo de seus materiais (profession, drop, buy). Permite encontrar, por exemplo, itens feitos exclusivamente com materiais de profissão, ou itens que não usam materiais de drop, ou que obrigatoriamente contêm materiais comprados. Use para perguntas como "Quais itens só usam materiais de profissão?", "Liste crafts sem materiais de drop", "Quais itens usam materiais comprados de NPC?", "Existem crafts que misturam materiais de drop e profissão?", ou "Filtre itens por tipo de material: [tipo/perfil]".',
        parameters: {
          type: 'OBJECT',
          properties: {
            materialTypes: {
              type: 'STRING',
              description: 'Uma string contendo os tipos de materiais a considerar, separados por vírgula (ex: "profession", ou "drop,buy", ou "profession,drop"). Os tipos válidos são "profession", "drop", "buy".'
            },
            matchProfile: {
              type: 'STRING',
              description: 'Como os tipos de materiais devem corresponder. Valores válidos: "exclusive" (todos os materiais da receita devem ser de um dos materialTypes), "contains_any" (a receita deve conter pelo menos um material de qualquer um dos materialTypes), "contains_all" (a receita deve conter pelo menos um material de cada um dos materialTypes, se múltiplos forem fornecidos), "not_contains_any" (nenhum material da receita deve ser de um dos materialTypes). O padrão é "exclusive" se não especificado.',
              enum: ['exclusive', 'contains_any', 'contains_all', 'not_contains_any']
            }
          },
          required: ['materialTypes']
        }
      },
      {
        name: 'getMaterialUsageSummary',
        description: 'Fornece um sumário do uso de materiais em todas as receitas, incluindo a quantidade total necessária do material, em quantas receitas diferentes ele é usado, e o preço NPC de referência do material se um nome específico for consultado. Pode ser filtrado por nome de material ou tipo de material. Útil para perguntas como "Qual a demanda total por [nome do material]?", "Quantos [nome do material] são usados no total em todos os crafts?", "Quais materiais do tipo [tipo] são os mais utilizados?", "Resumo de uso do material [nome do material]", ou "Qual o preço NPC do [nome do material]?".',
        parameters: {
          type: 'OBJECT',
          properties: {
            materialName: {
              type: 'STRING',
              description: 'O nome (ou parte do nome) de um material específico para filtrar o sumário (ex: "Essence of Fire", "potion"). A busca não diferencia maiúsculas/minúsculas. Opcional.'
            },
            materialTypes: {
              type: 'STRING',
              description: 'Tipos de materiais a considerar para o sumário, separados por vírgula (ex: "drop", "buy,profession"). Opcional. Se omitido, considera todos os tipos.'
            }
          },
        }
      },
      {
        name: 'checkCraftingPossibilities',
        description: 'Verifica quais itens de craft podem ser fabricados IMEDIATAMENTE com base em uma lista exata de materiais que o usuário possui e suas respectivas quantidades. Retorna os itens que podem ser feitos e o máximo de vezes. Responde a perguntas como "Tenho 20 X e 10 Y, o que posso fazer agora e quantos?", "Com estes materiais [lista de materiais e quantidades], o que consigo craftar já?" ou "Verifique minhas possibilidades de fabricação atuais com meu inventário."',
        parameters: {
          type: 'OBJECT',
          properties: {
            availableMaterials: {
              type: 'ARRAY',
              description: 'Uma lista de materiais que o usuário possui e suas quantidades.',
              items: {
                type: 'OBJECT',
                description: 'Um material que o usuário possui.',
                properties: {
                  material_name: {
                    type: 'STRING',
                    description: 'Nome do material que o usuário possui (ex: "Ice Crystal").'
                  },
                  quantity: {
                    type: 'NUMBER',
                    description: 'Quantidade desse material que o usuário possui (ex: 20).'
                  }
                },
                required: ["material_name", "quantity"]
              }
            }
          },
          required: ['availableMaterials']
        }
      },
      {
        name: 'analyzeCraftingPotential',
        description: "Analisa receitas que podem ser relevantes com base nos materiais que o usuário possui (mesmo que não sejam suficientes para completar o craft) ou analisa todas as receitas se nenhum material for fornecido. Detalha, para cada receita aplicável, todos os materiais necessários, quanto o usuário possui de cada um, e quanto falta para um craft. Também informa quantos crafts daquela receita podem ser feitos imediatamente com os materiais fornecidos. Use para perguntas como 'Tenho [Material A] e [QtdA] de [MaterialA], o que mais preciso para fazer outros itens?', 'Com [Material A] e [Material B], quais crafts posso começar e o que faltaria para completá-los?', 'Se eu tiver [MaterialX], quais receitas ele ajuda a fazer e o que faltaria?', ou 'Se eu não fornecer nenhum material, mostre todas as receitas e o que preciso para cada uma'.",
        parameters: {
          type: 'OBJECT',
          properties: {
            userMaterials: {
              type: 'ARRAY',
              description: 'Uma lista de materiais que o usuário possui e suas quantidades. Se omitido ou um array vazio for fornecido, analisa todas as receitas mostrando o que é necessário para cada uma.',
              items: {
                type: 'OBJECT',
                description: 'Um material que o usuário possui.',
                properties: {
                  material_name: {
                    type: 'STRING',
                    description: 'Nome do material que o usuário possui (ex: "Iron Ore").'
                  },
                  quantity: {
                    type: 'NUMBER',
                    description: 'Quantidade desse material que o usuário possui (ex: 50).'
                  }
                },
                required: ["material_name", "quantity"]
              }
            }
          }
        }
      },
      {
        name: 'getPokemonDetails',
        description: 'Obtém informações detalhadas sobre um Pokémon específico da PokeAPI, como seus tipos, habilidades (apenas nomes), estatísticas base e número da Pokédex. Ideal para perguntas como "Quais são os tipos do Pikachu?", "Me fale sobre o Charizard.", "Detalhes do Snorlax", "Quais as habilidades do Gengar?" ou "Informações do Pokémon [NomePokemon]". O nome do Pokémon deve ser fornecido em letras minúsculas.',
        parameters: {
          type: 'OBJECT',
          properties: {
            pokemonName: {
              type: 'STRING',
              description: 'O nome do Pokémon a ser pesquisado (ex: "pikachu", "charizard"). Deve ser em letras minúsculas.'
            }
          },
          required: ['pokemonName']
        }
      },
      {
        name: 'getPokemonEvolutionChain',
        description: "Obtém e descreve a cadeia de evolução de um Pokémon específico, mostrando de qual Pokémon ele evolui e para quais Pokémon ele pode evoluir. Útil para perguntas como 'Quais são as evoluções de [PokemonName]?', 'Como [PokemonName] evolui?', 'Mostre a linha evolutiva de [PokemonName]', '[PokemonName] tem evolução?', ou 'Para quem [PokemonName] evolui?'.",
        parameters: {
            type: 'OBJECT',
            properties: {
                pokemonName: {
                    type: 'STRING',
                    description: 'O nome do Pokémon cuja cadeia de evolução deve ser buscada (ex: "pichu", "eevee"). Deve ser em letras minúsculas.'
                }
            },
            required: ['pokemonName']
        }
      },
      {
        name: 'getPokemonTypeEffectiveness',
        description: "Descreve as fraquezas, resistências e imunidades de um Pokémon com base em seus tipos. Útil para 'Contra quais tipos [PokemonName] é fraco?', '[PokemonName] é forte contra quais tipos?', 'Quais são as resistências do [PokemonName]?', ou 'Efetividade de tipo do [PokemonName]'.",
        parameters: {
            type: 'OBJECT',
            properties: {
                pokemonName: {
                    type: 'STRING',
                    description: 'O nome do Pokémon para analisar a efetividade de seus tipos (ex: "bulbasaur", "charmander"). Deve ser em letras minúsculas.'
                }
            },
            required: ['pokemonName']
        }
      },
      {
        name: 'getAbilityDetails',
        description: "Obtém a descrição detalhada do efeito de uma habilidade (ability) de Pokémon. Útil para 'O que faz a habilidade [NomeHabilidade]?' ou 'Descreva a habilidade [NomeHabilidade]'.",
        parameters: {
            type: 'OBJECT',
            properties: {
                abilityName: {
                    type: 'STRING',
                    description: 'O nome da habilidade a ser pesquisada (ex: "stench", "static", "overgrow"). Deve ser em letras minúsculas e pode usar hífen se o nome da habilidade tiver.'
                }
            },
            required: ['abilityName']
        }
      }
    ]
  }
];


export async function initChatbot() {
  if (!API_KEY || API_KEY === 'SUA_API_KEY_GEMINI') {
    console.error("API Key do Gemini não configurada em chatbotService.js. Por favor, adicione sua chave.");
    throw new Error("API Key do Gemini não configurada.");
  }
  try {
    const { GoogleGenerativeAI } = await import('https://esm.run/@google/generative-ai');
    const genAI = new GoogleGenerativeAI(API_KEY);
    generativeModel = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-latest",
      tools: tools,
    });
    chat = generativeModel.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: "Você é o RaitoCraft Assistant, um chatbot especializado em ajudar usuários com cálculos e informações sobre crafting de itens no jogo Pokexgames, baseado nos dados da API RaitoCraft, e também pode fornecer informações sobre Pokémon utilizando a PokeAPI. Suas respostas devem ser amigáveis, úteis e focadas nos contextos do jogo, do crafting e do universo Pokémon. Use as ferramentas disponíveis para obter todas as informações necessárias ANTES de formular uma resposta. Não anuncie qual ferramenta você está usando nem peça confirmação ao usuário (como 'Ok') antes de prosseguir com a busca de dados. Formule sua resposta final diretamente com base nas informações coletadas pelas ferramentas. Use Markdown para melhor legibilidade: para listas (como listas de materiais ou itens), use marcadores (bullet points, começando cada item com '- ' ou '* '). Para destacar nomes de itens, materiais, Pokémon ou informações importantes, use negrito ('**texto**'). Evite usar asteriscos de forma que apareçam como caracteres soltos ou que dificultem a leitura da estrutura da lista. Se um item de uma lista principal tiver uma sub-lista de componentes (como materiais adicionais para um item craftável), formate esses componentes como uma sub-lista indentada com marcadores. Se a pergunta envolver cálculos (como quantidades para múltiplos packs de um item), realize esses cálculos internamente e apresente o resultado final de forma clara. Seja conciso e direto ao ponto. Por exemplo, se perguntarem 'O que preciso para fazer 10 packs de Beast Balls?', obtenha a receita da Beast Ball, calcule as quantidades totais para 10 packs e responda diretamente: 'Para fazer 10 packs de Beast Balls (totalizando X unidades), você precisará de:' seguido de uma lista de materiais e suas quantidades totais. Se uma função da API retornar uma lista vazia (ex: nenhum item encontrado), informe explicitamente ao usuário que 'Nenhum item/receita foi encontrado com os critérios fornecidos para a sua pergunta sobre [assunto da pergunta].'. Se uma função da API falhar e retornar um erro, informe ao usuário de forma clara: 'Houve um problema ao tentar buscar os dados sobre [assunto da pergunta]: [detalhes do erro da API].'. Ao usar 'analyzeCraftingPotential', para cada receita relevante, liste o nome da receita, os materiais necessários, quantos o usuário possui de cada, e quantos faltam para um craft; indique também quantos crafts completos daquela receita são possíveis no momento com os materiais fornecidos pelo usuário. Ao apresentar dados de Pokémon, como evoluções ou efetividade de tipos, formate a informação de maneira clara e legível, usando listas ou parágrafos curtos." }],
        },
        {
          role: "model",
          parts: [{ text: "Entendido! Estou pronto para ajudar os jogadores de Pokexgames com seus crafts e também para responder perguntas sobre o universo Pokémon. Buscarei as informações e responderei diretamente, usando formatação Markdown clara e estruturada para facilitar a leitura. Se a API não encontrar nada para uma busca, informarei claramente que nenhum resultado correspondeu. Se ocorrer um erro ao tentar buscar os dados, informarei sobre a falha detalhada da função. Se a busca for bem-sucedida, apresentarei os dados diretamente, incluindo detalhes de materiais faltantes quando relevante e formatando informações de Pokémon da melhor forma. Podem perguntar!" }],
        }
      ],
    });
    console.log("Chatbot Gemini inicializado com sucesso.");
  } catch (error) {
    console.error("Erro ao inicializar o GoogleGenerativeAI:", error);
    throw new Error("Falha ao inicializar o serviço de IA.");
  }
}

async function callApiFunction(functionName, args) {
  console.log(`[callApiFunction] Iniciando chamada para: ${functionName} com args:`, args);
  let endpoint = '';
  let method = 'GET';
  let body = null;
  let queryParams = new URLSearchParams();
  let requiresOnlineFetch = true;

  try {
    switch (functionName) {
      case 'getRecipeByName':
        if (!args.itemName) {
            console.error("[callApiFunction] getRecipeByName: Nome do item não fornecido.");
            throw new Error("Nome do item é obrigatório para getRecipeByName.");
        }
        endpoint = `${RAITOCRAFT_API_BASE_URL}/items`;
        break;
      case 'findCraftsByMaterial':
        if (!args.materialName) {
            console.error("[callApiFunction] findCraftsByMaterial: Nome do material não fornecido.");
            throw new Error("Nome do material é obrigatório para findCraftsByMaterial.");
        }
        queryParams.append('materialName', args.materialName);
        endpoint = `${RAITOCRAFT_API_BASE_URL}/items/by-material?${queryParams.toString()}`;
        break;
      case 'getItemNpcSellPrice':
        if (!args.itemName) {
            console.error("[callApiFunction] getItemNpcSellPrice: Nome do item não fornecido.");
            throw new Error("Nome do item é obrigatório para getItemNpcSellPrice.");
        }
        endpoint = `${RAITOCRAFT_API_BASE_URL}/items/name/${encodeURIComponent(args.itemName)}`;
        break;
      case 'listAllCraftableItems':
        endpoint = `${RAITOCRAFT_API_BASE_URL}/items`;
        break;
      case 'getMostProfitableItemsByNpcPrice':
        endpoint = `${RAITOCRAFT_API_BASE_URL}/items/most-profitable-npc`;
        break;
      case 'filterItemsByMaterialProfile':
        if (!args.materialTypes) {
            console.error("[callApiFunction] filterItemsByMaterialProfile: Tipos de material não fornecidos.");
            throw new Error("Tipos de material são obrigatórios para filterItemsByMaterialProfile.");
        }
        queryParams.append('materialTypes', args.materialTypes);
        if (args.matchProfile) {
          queryParams.append('matchProfile', args.matchProfile);
        }
        endpoint = `${RAITOCRAFT_API_BASE_URL}/items/filter-by-material-profile?${queryParams.toString()}`;
        break;
      case 'getMaterialUsageSummary':
        if (args.materialName) {
          queryParams.append('materialName', args.materialName);
        }
        if (args.materialTypes) {
          queryParams.append('materialTypes', args.materialTypes);
        }
        endpoint = `${RAITOCRAFT_API_BASE_URL}/materials/usage-summary?${queryParams.toString()}`;
        break;
      case 'checkCraftingPossibilities':
        if (!args.availableMaterials || !Array.isArray(args.availableMaterials)) {
            console.error("[callApiFunction] checkCraftingPossibilities: Materiais disponíveis não fornecidos ou não é array.");
            throw new Error("Materiais disponíveis são obrigatórios para checkCraftingPossibilities e devem ser um array.");
        }
        method = 'POST';
        endpoint = `${RAITOCRAFT_API_BASE_URL}/crafting/check-possibilities`;
        body = JSON.stringify({ availableMaterials: args.availableMaterials });
        break;
      case 'analyzeCraftingPotential':
        method = 'POST';
        endpoint = `${RAITOCRAFT_API_BASE_URL}/crafting/analyze-potential-crafts`;
        body = JSON.stringify({ userMaterials: args.userMaterials || [] });
        break;
      case 'getPokemonDetails':
        if (!args.pokemonName) {
            console.error("[callApiFunction] getPokemonDetails: Nome do Pokémon não fornecido.");
            throw new Error("Nome do Pokémon é obrigatório para getPokemonDetails.");
        }
        endpoint = `${POKEAPI_BASE_URL}/pokemon/${args.pokemonName.toLowerCase()}`;
        break;
      case 'getPokemonEvolutionChain':
        if (!args.pokemonName) {
            console.error("[callApiFunction] getPokemonEvolutionChain: Nome do Pokémon não fornecido.");
            throw new Error("Nome do Pokémon é obrigatório para getPokemonEvolutionChain.");
        }
        endpoint = `${POKEAPI_BASE_URL}/pokemon-species/${args.pokemonName.toLowerCase()}`;
        break;
      case 'getPokemonTypeEffectiveness':
        if (!args.pokemonName) {
            console.error("[callApiFunction] getPokemonTypeEffectiveness: Nome do Pokémon não fornecido.");
            throw new Error("Nome do Pokémon é obrigatório para getPokemonTypeEffectiveness.");
        }
        endpoint = `${POKEAPI_BASE_URL}/pokemon/${args.pokemonName.toLowerCase()}`; 
        break;
      case 'getAbilityDetails':
        if (!args.abilityName) {
            console.error("[callApiFunction] getAbilityDetails: Nome da Habilidade não fornecido.");
            throw new Error("Nome da Habilidade é obrigatório para getAbilityDetails.");
        }
        endpoint = `${POKEAPI_BASE_URL}/ability/${args.abilityName.toLowerCase()}`;
        break;
      default:
        console.error(`[callApiFunction] Função desconhecida: ${functionName}`);
        return { success: false, error: `Função desconhecida: ${functionName}` };
    }

    let apiData;
    if (requiresOnlineFetch) {
        console.log(`[callApiFunction] Chamando API: ${method} ${endpoint}`);
        const headers = { 'Content-Type': 'application/json' };
        const response = await fetch(endpoint, {
          method: method,
          headers: method === 'POST' ? headers : {},
          body: body,
        });

        if (!response.ok) {
          const errorData = await response.text();
          console.error(`[callApiFunction] Erro da API externa (${response.status}) ao chamar ${endpoint} para função ${functionName}:`, errorData);
          return { success: false, error: `Erro ao chamar API externa (${functionName} em ${endpoint}): ${response.status} - ${errorData || response.statusText}` };
        }
        try {
            apiData = await response.json();
        } catch (jsonError) {
            console.error(`[callApiFunction] Erro ao parsear JSON da API externa ${endpoint} para função ${functionName}:`, jsonError);
            const textResponse = await response.text();
            console.error(`[callApiFunction] Resposta da API (texto) ${endpoint}:`, textResponse);
            return { success: false, error: `Erro ao processar resposta da API (${functionName} em ${endpoint}): Formato JSON inválido.` };
        }
        console.log(`[callApiFunction] Dados recebidos da API externa (${functionName} de ${endpoint}):`, apiData);
    }

    if (functionName === 'getRecipeByName') {
        if (!apiData || !Array.isArray(apiData)) {
            console.error(`[callApiFunction] getRecipeByName: A resposta de ${RAITOCRAFT_API_BASE_URL}/items não foi um array. Valor:`, apiData);
            return { success: false, error: `Falha ao obter a lista de itens da API (esperava um array).` };
        }
        const itemNameLower = args.itemName.toLowerCase();
        const foundItem = apiData.find(item => item.name.toLowerCase() === itemNameLower);
        if (foundItem) {
            console.log(`[callApiFunction] getRecipeByName: Item "${args.itemName}" encontrado.`, foundItem);
            return { success: true, data: foundItem };
        } else {
            console.log(`[callApiFunction] getRecipeByName: Item "${args.itemName}" NÃO encontrado na lista.`);
            return { success: true, data: null }; 
        }
    }

    if (functionName === 'getItemNpcSellPrice') {
        return { success: true, data: { itemName: args.itemName, npc_sell_price: apiData.npc_sell_price } };
    }

    if (functionName === 'listAllCraftableItems') {
        if (!apiData || !Array.isArray(apiData)) {
            console.error(`[callApiFunction] listAllCraftableItems: A resposta de ${RAITOCRAFT_API_BASE_URL}/items não foi um array. Valor:`, apiData);
            return { success: false, error: `Falha ao obter a lista de itens da API (esperava um array).` };
        }
        const maxItems = args.maxItemsToShow || 15;
        const itemsToReturn = apiData.slice(0, maxItems).map(item => ({
            name: item.name,
            quantity_produced: item.quantity_produced
        }));
        return {
            success: true,
            data: {
                items: itemsToReturn,
                totalItems: apiData.length,
                showing: itemsToReturn.length
            }
        };
    }

    if (functionName === 'getPokemonEvolutionChain') {
        if (!apiData.evolution_chain || !apiData.evolution_chain.url) {
            console.error('[callApiFunction] getPokemonEvolutionChain: URL da cadeia de evolução não encontrada na resposta da espécie.');
            return { success: false, error: 'Não foi possível encontrar o link para a cadeia de evolução.' };
        }
        const evolutionChainUrl = apiData.evolution_chain.url;
        console.log(`[callApiFunction] getPokemonEvolutionChain: Buscando URL da cadeia de evolução: ${evolutionChainUrl}`);
        const evoChainResponse = await fetch(evolutionChainUrl);
        if (!evoChainResponse.ok) {
            const errorData = await evoChainResponse.text();
            console.error(`[callApiFunction] getPokemonEvolutionChain: Erro ao buscar dados da cadeia de evolução (${evoChainResponse.status}):`, errorData);
            return { success: false, error: `Erro ao buscar dados da cadeia de evolução: ${evoChainResponse.status} - ${errorData || evoChainResponse.statusText}` };
        }
        const evolutionChainData = await evoChainResponse.json();
        
        let evolutions = [];
        function traverseChain(chainLink) {
            if (!chainLink) return;
            evolutions.push(chainLink.species.name);
            if (chainLink.evolves_to && chainLink.evolves_to.length > 0) {
                chainLink.evolves_to.forEach(evo => traverseChain(evo));
            }
        }
        traverseChain(evolutionChainData.chain);
        const uniqueEvolutions = [...new Set(evolutions)];
        const evolutionPath = uniqueEvolutions.join(' -> ');
        return { success: true, data: { pokemonName: args.pokemonName, evolutionChain: evolutionPath || 'Nenhuma evolução direta encontrada ou Pokémon já está no estágio final.' } };
    }

    if (functionName === 'getPokemonTypeEffectiveness') {
        if (!apiData.types || !Array.isArray(apiData.types)) {
            return { success: false, error: 'Não foi possível obter os tipos do Pokémon.' };
        }
        const typePromises = apiData.types.map(typeInfo => fetch(typeInfo.type.url).then(res => {
            if(!res.ok) throw new Error(`Falha ao buscar detalhes do tipo ${typeInfo.type.name}: ${res.status}`);
            return res.json();
        }));
        
        const typeDetails = await Promise.all(typePromises);

        const effectiveness = {
            takes_2x_from: new Set(), takes_0_5x_from: new Set(), takes_0x_from: new Set(),
            deals_2x_to: new Set(), deals_0_5x_to: new Set(), deals_0x_to: new Set()
        };

        typeDetails.forEach(typeData => {
            typeData.damage_relations.double_damage_from.forEach(t => effectiveness.takes_2x_from.add(t.name));
            typeData.damage_relations.half_damage_from.forEach(t => effectiveness.takes_0_5x_from.add(t.name));
            typeData.damage_relations.no_damage_from.forEach(t => effectiveness.takes_0x_from.add(t.name));
            typeData.damage_relations.double_damage_to.forEach(t => effectiveness.deals_2x_to.add(t.name));
            typeData.damage_relations.half_damage_to.forEach(t => effectiveness.deals_0_5x_to.add(t.name));
            typeData.damage_relations.no_damage_to.forEach(t => effectiveness.deals_0x_to.add(t.name));
        });
        
        return { 
            success: true, 
            data: {
                pokemonName: args.pokemonName,
                types: apiData.types.map(t => t.type.name),
                effectiveness: {
                    weak_to: Array.from(effectiveness.takes_2x_from),
                    resistant_to: Array.from(effectiveness.takes_0_5x_from),
                    immune_to: Array.from(effectiveness.takes_0x_from),
                }
            }
        };
    }

    if (functionName === 'getAbilityDetails') {
        const effectEntry = apiData.effect_entries?.find(entry => entry.language.name === 'en');
        return { 
            success: true, 
            data: { 
                abilityName: args.abilityName, 
                effect: effectEntry ? effectEntry.short_effect || effectEntry.effect : "Descrição não encontrada em inglês.",
                full_description_available: !!(effectEntry && effectEntry.effect)
            } 
        };
    }
    
    return { success: true, data: apiData };

  } catch (error) {
    console.error(`[callApiFunction] Erro geral ao executar a função ${functionName} ou chamar a API:`, error);
    return { success: false, error: `Erro interno ao processar ${functionName}: ${error.message}` };
  }
}

export async function sendMessageToGemini(message) {
  if (!chat) {
    console.error("Chatbot não inicializado. Chame initChatbot() primeiro.");
    return { error: "Chatbot não está pronto." };
  }

  try {
    console.log("Enviando para Gemini:", message);
    const result = await chat.sendMessage(message);
    let response = result.response;
    console.log("Resposta inicial do Gemini:", JSON.stringify(response, null, 2));

    let functionCall = response.candidates?.[0]?.content?.parts?.[0]?.functionCall;
    
    while (functionCall) {
      console.log("Gemini solicitou chamada de função:", functionCall.name, "com args:", functionCall.args);
      const apiResponse = await callApiFunction(functionCall.name, functionCall.args);

      console.log("Enviando FunctionResponse para Gemini:", JSON.stringify({ name: functionCall.name, response: apiResponse }, null, 2));

      const functionCallResult = await chat.sendMessage([
        {
          functionResponse: {
            name: functionCall.name,
            response: apiResponse, 
          },
        },
      ]);
      response = functionCallResult.response;
      console.log("Resposta do Gemini após Function Call:", JSON.stringify(response, null, 2));
      functionCall = response.candidates?.[0]?.content?.parts?.[0]?.functionCall;
    }

    const textResponse = response.candidates?.[0]?.content?.parts
      ?.filter(part => part.text)
      ?.map(part => part.text)
      ?.join('');
      
    console.log("Resposta final de texto do Gemini:", textResponse);
    return { text: textResponse || "Não consegui processar sua solicitação no momento." };

  } catch (error) {
    console.error("Erro ao enviar mensagem ou processar resposta do Gemini:", error);
    const geminiError = error.response?.candidates?.[0]?.finishReason
      ? `O modelo terminou devido a: ${error.response.candidates[0].finishReason}. Detalhes: ${JSON.stringify(error.response.candidates[0].safetyRatings)}`
      : error.message;
    return { error: `Erro na comunicação com a IA: ${geminiError}` };
  }
}