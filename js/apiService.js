/*
  Arquivo: apiService.js
  Descrição: Este módulo é responsável por toda a comunicação com a API backend.
  Ele abstrai as chamadas fetch e o tratamento de respostas, fornecendo funções claras
  para realizar operações CRUD (Create, Read, Update, Delete) relacionadas aos itens e suas receitas.
  Principais Funções:
  - handleResponse: Função auxiliar para processar a resposta de uma chamada fetch,
                    verificando o status e convertendo o corpo da resposta para JSON ou texto.
  - fetchItems: Busca a lista de todos os itens craftáveis, incluindo seus materiais.
  - fetchRecipe: Busca os detalhes de uma receita específica de um item pelo seu ID.
  - createItem: Envia os dados de uma nova receita para o backend para criação.
  - updateItem: Envia os dados atualizados de uma receita para o backend.
  - deleteItem: Solicita a remoção de uma receita do backend pelo seu ID.
  Constantes:
  - API_BASE_URL: Define a URL base para todas as requisições à API.
                  Agora é definida dinamicamente com base no hostname.
*/


let resolvedApiBaseUrl;
if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    resolvedApiBaseUrl = 'http://localhost:3000/api';
} else {
    resolvedApiBaseUrl = 'https://apiraitocraft.onrender.com/api';
}
const API_BASE_URL = resolvedApiBaseUrl;



async function handleResponse(response) {
    const contentType = response.headers.get("content-type");
    let data;
    if (contentType && contentType.indexOf("application/json") !== -1) {
        data = await response.json();
    } else {
        data = await response.text();
    }

    if (!response.ok) {
        const error = (data && data.error) || data || response.statusText;
        return Promise.reject(new Error(error));
    }
    return data;
}

export async function fetchItems() {
    try {
        const response = await fetch(`${API_BASE_URL}/items`);
        return await handleResponse(response);
    } catch (error) {
        console.error("Erro ao buscar itens:", error);
        throw error;
    }
}

export async function fetchRecipe(itemId) {
    if (!itemId) return Promise.resolve(null);
    try {
        const response = await fetch(`${API_BASE_URL}/items/${itemId}/recipe`);
         if (response.status === 404) {
             return null;
         }
        return await handleResponse(response);
    } catch (error) {
        console.error(`Erro ao buscar receita para item ${itemId}:`, error);
        throw error;
    }
}

export async function createItem(recipeData) {
    try {
        const response = await fetch(`${API_BASE_URL}/items`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(recipeData),
        });
        return await handleResponse(response);
    } catch (error) {
        console.error("Erro ao criar item:", error);
        throw error;
    }
}

export async function updateItem(itemId, recipeData) {
     if (!itemId) return Promise.reject(new Error("ID do item inválido para atualização."));
    try {
        const response = await fetch(`${API_BASE_URL}/items/${itemId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(recipeData),
        });
        return await handleResponse(response);
    } catch (error) {
        console.error(`Erro ao atualizar item ${itemId}:`, error);
        throw error;
    }
}

export async function deleteItem(itemId) {
     if (!itemId) return Promise.reject(new Error("ID do item inválido para deleção."));
    try {
        const response = await fetch(`${API_BASE_URL}/items/${itemId}`, {
            method: 'DELETE',
        });
        if (response.status === 204) {
             return { message: 'Receita deletada com sucesso!' };
        }
        return await handleResponse(response);
    } catch (error) {
        console.error(`Erro ao deletar item ${itemId}:`, error);
        throw error;
    }
}