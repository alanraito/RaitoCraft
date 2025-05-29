/*
  Arquivo: chatbotService.js
  Descrição: Este módulo é responsável por toda a lógica de interação com a API do Gemini
  e por orquestrar as chamadas para APIs externas (RaitoCraft e PokeAPI) com base nas
  solicitações do modelo de linguagem. Ele define as ferramentas (funções) que o Gemini
  pode chamar (como buscar receitas por nome de item ou por material), processa as respostas
  e gerencia o histórico da conversa para o chat, incluindo instruções detalhadas no
  prompt do sistema para lidar com respostas, dados vazios e erros de API de forma clara.
  Principais Funções:
  - initChatbot: Inicializa o chatbot, configurando a API Key do Gemini e o prompt do sistema com diretrizes de comportamento.
  - sendMessageToGemini: Envia a mensagem do usuário para o Gemini, incluindo o histórico
                         e as ferramentas disponíveis, e processa a resposta.
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
        description: "Obtém os detalhes completos de uma receita de craft, incluindo seus materiais, com base no nome do item produzido. Use para perguntas como 'Quais são os materiais para [nome do item]?' ou 'Como faço [nome do item]?' ou 'Que itens eu utilizo para fazer [nome do item]?'.",
        parameters: {
          type: 'OBJECT',
          properties: {
            itemName: {
              type: 'STRING',
              description: 'O nome exato do item cuja receita (incluindo materiais) deve ser buscada (ex: "Beast Ball", "Ice Sword").'
            }
          },
          required: ['itemName']
        }
      },
      {
        name: 'findCraftsByMaterial',
        description: 'Obtém uma lista de todos os itens de craft (receitas) que são feitos usando um material específico. Ideal para responder perguntas como "O que posso fazer com [nome do material]?" ou "Quais crafts usam [nome do material]?".',
        parameters: {
          type: 'OBJECT',
          properties: {
            materialName: {
              type: 'STRING',
              description: 'O nome exato do material a ser pesquisado (ex: "Ice Crystal", "Dragon Scale").'
            }
          },
          required: ['materialName']
        }
      },
      {
        name: 'getMostProfitableItemsByNpcPrice',
        description: 'Calcula e retorna uma lista dos itens de craft mais lucrativos para fabricar, considerando que todos os materiais são obtidos ou avaliados por seus preços de NPC e o item final é vendido também pelo preço de NPC. Os itens são listados do mais lucrativo para o menos. Útil para perguntas como "Qual item dá mais lucro vendendo pra NPC?" ou "O que compensa mais fazer com preços de NPC?".',
        parameters: { type: 'OBJECT', properties: {} }
      },
      {
        name: 'filterItemsByMaterialProfile',
        description: 'Filtra e retorna itens de craft com base no perfil de tipo de seus materiais. Por exemplo, itens feitos exclusivamente com materiais de profissão, ou itens que não usam materiais de drop. Para responder perguntas como "Quais itens só usam materiais de profissão?" ou "Liste crafts sem materiais de drop".',
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
        description: 'Fornece um sumário do uso de materiais em todas as receitas. Pode ser filtrado por nome de material ou tipo de material. Útil para perguntas como "Qual a demanda total por [nome do material]?" ou "Quais materiais do tipo [tipo] são mais usados?".',
        parameters: {
          type: 'OBJECT',
          properties: {
            materialName: {
              type: 'STRING',
              description: 'O nome (ou parte do nome) de um material específico para filtrar o sumário (ex: "Essence of Fire"). Opcional.'
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
        description: 'Verifica quais itens de craft podem ser fabricados com base em uma lista de materiais que o usuário possui e a quantidade de cada um. Responde a perguntas como "Tenho 20 X e 10 Y, o que posso fazer e quantos?"',
        parameters: {
          type: 'OBJECT',
          properties: {
            availableMaterials: {
              type: 'ARRAY',
              description: 'Uma lista de materiais que o usuário possui.',
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
        name: 'getPokemonDetails',
        description: 'Obtém informações detalhadas sobre um Pokémon específico da PokeAPI, como seus tipos, habilidades, estatísticas base e número da Pokédex. Ideal para perguntas como "Quais são os tipos do Pikachu?" ou "Me fale sobre o Charizard.". O nome do Pokémon deve ser fornecido em letras minúsculas.',
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
          parts: [{ text: "Você é o RaitoCraft Assistant, um chatbot especializado em ajudar usuários com cálculos e informações sobre crafting de itens no jogo Pokexgames, baseado nos dados da API RaitoCraft, e também pode fornecer informações sobre Pokémon utilizando a PokeAPI. Suas respostas devem ser amigáveis, úteis e focadas nos contextos do jogo, do crafting e do universo Pokémon. Você pode usar as ferramentas disponíveis para buscar informações atualizadas das APIs quando necessário. Se uma função da API retornar uma lista vazia (por exemplo, nenhum item encontrado para `getRecipeByName` ou `findCraftsByMaterial`), você deve informar explicitamente ao usuário que 'Nenhum item/receita foi encontrado com os critérios fornecidos para [nome da função].'. Se uma função da API falhar e retornar um erro, você deve informar ao usuário sobre o erro específico que ocorreu ao tentar acessar os dados (por exemplo, 'Houve um problema ao contatar a API ao usar [nome da função]: [detalhes do erro]'), em vez de pedir para o usuário fornecer os dados ou executar comandos. Após uma chamada de função bem-sucedida que retorna dados, apresente esses dados diretamente ao usuário de forma clara e concisa. Não faça introduções vagas como 'A API retornou os seguintes dados:' se você não for apresentar os dados imediatamente ou se for tentar chamar a função novamente." }],
        },
        {
          role: "model",
          parts: [{ text: "Entendido! Estou pronto para ajudar os jogadores de Pokexgames com seus crafts e também para responder perguntas sobre o universo Pokémon. Se a API não encontrar nada para uma busca, informarei claramente que nenhum resultado correspondeu à função específica. Se ocorrer um erro ao tentar buscar os dados, informarei sobre a falha detalhada da função. Se a busca for bem-sucedida, apresentarei os dados diretamente. Podem perguntar!" }],
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
      case 'getPokemonDetails':
        if (!args.pokemonName) {
            console.error("[callApiFunction] getPokemonDetails: Nome do Pokémon não fornecido.");
            throw new Error("Nome do Pokémon é obrigatório para getPokemonDetails.");
        }
        endpoint = `${POKEAPI_BASE_URL}/pokemon/${args.pokemonName.toLowerCase()}`;
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
            const textResponse = await response.text(); // Tenta ler como texto para log
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