# Sistema Simplificado de Acompanhamento de Processos (SAP) - Banestes

![Status](https://img.shields.io/badge/Status-Conclu%C3%ADdo-success)
![Tecnologias](https://img.shields.io/badge/Stack-Google_Apps_Script_%7C_Tailwind_CSS-blue)

Um sistema robusto de gerenciamento de processos de ajuizamento bancário, desenvolvido como parte do Desafio Técnico do Banco Banestes. Este projeto avalia a viabilidade financeira e estabelece a prioridade de ações de recuperação de crédito antes de iniciar processos judiciais, reduzindo custos operacionais.

## Tecnologias Utilizadas

- **Frontend:** HTML, Tailwind CSS & JavaScript
- **Backend:** Google Apps Script (`.gs`) com arquitetura Servidor/Cliente
- **Banco de Dados:** Google Sheets (Planilhas Google) como Data Store relacional

## Principais Funcionalidades (CRUD)

- **Leitura (Read):** Dashboard dinâmico com métricas em tempo real e visualização de todos os processos cadastrados nativamente cruzando chaves relacionais (ID Cliente, Unidade e Produto).
- **Criação (Create):** Formulário interativo para lançamento de um novo processo com geração autônoma de `ID` único (ex: `PROC-1234`).
- **Atualização (Update):** Edição rápida permitindo alteração no Status do processo, correção de valores contratuais ou anexação de novas Garantias Reais.
- **Exclusão (Delete):** Deleção limpa da linha correspondente no Google Sheets utilizando o id e index nativos da planilha.

## Regras de Negócio Implementadas

1. **Viabilidade Financeira:** Processos com valores de contrato ou dívida menores que **R$ 15.000,00** recebem uma _flag_ de Baixa Viabilidade, sinalizando que os custos operacionais (cartórios, advogados) podem não justificar o ajuizamento.
2. **Sistema de Garantias:** A existência de uma Garantia Real (Carro, Moto, Imóvel ou Equipamento) eleva ativamente a prioridade do ajuizamento, destacando a linha com tag verde.
3. **Mapeamento Relacional e Sanitização:** O backend resolve nativamente instâncias de Data para texto (evitando quebra de serialização JSON do Google Apps Script), ignora formatação corrompida de moeda (limpando o `R$` e o ponto do milhar), normaliza IDs numéricos/strings, e mapeia chaves estrangeiras entre dezenas de colunas dinamicamente para resgatar os nomes exatos em vez de exibir somente o `#ID` cru.

## Estrutura do Projeto

```bash
📦 Desafio-Banestes-SAP
 ┣ 📜 Cliente.html 
 ┗📜 Servidor.gs  
```

---
Desenvolvido com dedicação e atenção aos detalhes técnicos, focando na excelência da Interface do Usuário (UI/UX) e código limpo bem documentado.
