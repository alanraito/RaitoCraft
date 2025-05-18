/*
  Arquivo: calculator.js
  Descrição: Este módulo contém a lógica de negócios para calcular custos de crafting e lucros.
  Ele é responsável por processar os dados da receita, os preços de mercado dos materiais e
  as quantidades desejadas para fornecer uma análise financeira da produção de um item.
  Principais Funções:
  - calculateCraftingCost: Calcula o custo total para produzir uma certa quantidade de "packs" de um item.
                           Leva em consideração os preços de mercado unitários dos materiais e, opcionalmente,
                           custos específicos para materiais de profissão definidos pelo usuário.
  - calculateProfit: Calcula o lucro (ou prejuízo) da venda dos packs produzidos,
                     comparando o custo de produção com os preços de venda no mercado e no NPC.
  - formatCurrency: Formata um valor numérico como uma string de moeda para exibição.
  Modificações Recentes:
  - A função `calculateCraftingCost` foi atualizada para aceitar e utilizar custos opcionais
    para itens de profissão, permitindo um cálculo de custo mais preciso.
*/

export function calculateCraftingCost(recipeData, marketPricesUnit, desiredPacks, professionMaterialCosts = {}) {
    let totalCost = 0;
    if (!recipeData || !recipeData.materials || desiredPacks <= 0) {
        console.warn("Dados inválidos para cálculo de custo (packs).", recipeData, desiredPacks);
        return 0;
    }

    recipeData.materials.forEach(material => {
        const totalQuantityNeeded = material.quantity * desiredPacks;

        if (material.material_type === 'drop' || material.material_type === 'buy') {
            const marketPriceUnit = marketPricesUnit[material.material_name];
            if (typeof marketPriceUnit !== 'number' || marketPriceUnit < 0) {
                console.warn(`Preço de mercado unitário inválido ou ausente para ${material.material_name}. Usando 0.`);
            }
            totalCost += totalQuantityNeeded * (marketPriceUnit || 0);
        } else if (material.material_type === 'profession') {
            const userDefinedCost = professionMaterialCosts[material.material_name];
            if (typeof userDefinedCost === 'number' && userDefinedCost >= 0) {
                totalCost += totalQuantityNeeded * userDefinedCost;
                console.log(`[CostCalc] Incluindo custo de profissão para ${material.material_name}: ${totalQuantityNeeded} x ${userDefinedCost} = ${totalQuantityNeeded * userDefinedCost}`);
            }
        }
    });

    return totalCost;
}

export function calculateProfit(cost, recipeData, sellPricesTotal, desiredPacks) {
     if (!recipeData || desiredPacks <= 0) {
        console.warn("Dados inválidos para cálculo de lucro (packs).", recipeData, desiredPacks);
         return { profitMarket: 0, profitNPC: 0, totalRevenueMarket: 0, totalRevenueNPC: 0 };
     }
    const totalRevenueMarket = sellPricesTotal.market || 0;
    const totalRevenueNPC = (recipeData.npc_sell_price || 0) * desiredPacks;
    const profitMarket = totalRevenueMarket - cost;
    const profitNPC = totalRevenueNPC - cost;
    return { profitMarket, profitNPC, totalRevenueMarket, totalRevenueNPC };
}

export function formatCurrency(value) {
    if (typeof value !== 'number') return '0';
    return Math.floor(value).toLocaleString('pt-BR');
}