# Novidades do Cofrinho

Esquema de versão:

- **Primeiro número** — funcionalidades importantes (2.0, 3.0…).
- **Segundo número** — correções, melhorias e funcionalidades simples (1.1, 1.2…).

O mesmo histórico aparece no app em *Perfil › Sobre o app › Novidades* (`src/changelog.ts`) e, depois de cada atualização, num aviso com o que mudou desde a versão que estava instalada.

## 5.7 — Recorrentes previstos no calendário

- **Novo:** o calendário mostra os lançamentos recorrentes que ainda vão acontecer, como **previstos**: dias com borda tracejada, valores em cinza e itálico, e a linha marcada "Previsto" na lista do dia. Tocar num previsto abre o recorrente para editar.
- **Novo:** regra de previsão: os previstos aparecem só até o **fim do mês que vem**. Passando disso, o calendário avisa até quando vai a previsão.
- **Novo:** o resumo do mês mostra quanto **ainda está previsto** de despesas e receitas.
- Previsto não é lançamento: não entra no saldo, nos gráficos nem no orçamento, e não precisa recadastrar nada — vale para os recorrentes que já existem. Ele vira lançamento de verdade quando a data chega e o app é aberto, como antes.

## 5.6 — Ícone novo

- **Melhoria:** ícone do app redesenhado — o Gato da Sorte Pirata agora tem tapa-olho de couro com costura, alça marrom e moeda dourada com brilho. Vale para o ícone na tela do celular, a abertura do app e o logo dentro do app.

## 5.5 — Resumo nos gráficos, investimentos e cadastros prontos

- **Novo:** aba **Resumo** em *Gráficos* com comparativo Receitas × Despesas, saldo do período, taxa de economia, evolução com visão em **Barras** ou **Calendário** integrado e principais categorias.
- **Novo:** filtro de período nos gráficos por **Semana**, **Mês**, **Ano** e **Período personalizado** (com seletor em modal).
- **Novo:** contas, categorias, subcategorias e tags já vêm pré-cadastradas (Conta principal, Carteira, Vale-Refeição, Reserva de emergência, Investimentos, Valores a receber e Contas a pagar), inclusive em livros já existentes, com guia *"Como funcionam as contas?"* na tela de Contas.
- **Novo:** nas contas de **Investimento**, atalhos rápidos para **Aportar**, **Resgatar** e **Lançar rendimento**, além de **Simulador de rendimento** (100% CDI, 110% CDI, 1,0% a.m. e Poupança em 1 mês, 6 meses, 1 ano e 5 anos).
- **Novo:** faixa de **Metas** direto na tela *Início* para acompanhar o progresso e guardar dinheiro com um toque.
- **Melhoria:** tocar e segurar categorias, subcategorias, botões da barra de lançamento e tipos de conta mostra um balão com o nome e a explicação completa.
- **Correção:** textos explicativos nas linhas de configuração não ficam mais cortados com `...`, e o espaçamento entre o cabeçalho e o primeiro card foi corrigido em todas as telas.

## 5.4 — Sons e dicas nos ícones

- **Correção:** tocar e segurar um ícone não mostrava o balão no celular — o Android assume o toque (cerca de 0,4 s) antes do balão aparecer. Agora o balão aparece por esse sinal do Android também, não fica escondido debaixo do dedo nos ícones do topo e continua 2 segundos na tela depois de soltar.
- **Melhoria:** sons em todo o app, sintetizados (sem arquivos de áudio):
  - **Toques:** clique em botões e ícones, som de seleção em abas, chips, categorias e fatias dos gráficos, liga/desliga nas chaves, menu de baixo, janelas que sobem e descem, balão de dica e arrastar para apagar ou reordenar.
  - **Resultados:** salvar, moeda ao guardar dinheiro numa meta, comemoração ao alcançar a meta, apagar (ao confirmar), erro (avisos em vermelho e PIN errado) e desbloqueio.
  - Um só som por momento: "salvo" seguido do aviso de sucesso toca uma vez.
- **Melhoria:** sons configuráveis na nova tela *Configurações › Sons*:
  - **Sons no app:** liga/desliga tudo.
  - **Volume:** baixo, médio ou alto (toca uma amostra ao trocar).
  - **Quais sons tocar:** Botões e ícones · Teclado de valores e PIN · Abas, opções e chaves · Menu e janelas · Dicas e gestos · Salvar e concluir · Moedas e metas · Apagar · Erros e avisos — cada um com sua chave e um botão ▶ para ouvir.

## 5.3 — Cadastro mais claro

- **Melhoria:** o cadastro de conta muda conforme o tipo escolhido, com uma explicação em cada opção:
  - **Cartão de crédito:** banco, nome, limite, fechamento e vencimento.
  - **Conta bancária e carteira digital:** banco/app e "Saldo atual".
  - **Investimento:** banco/corretora e "Valor aplicado hoje".
  - **Dinheiro:** "Quanto tem agora".
  - **A receber:** "Quem te deve?" e "Quanto te devem hoje".
  - **A pagar:** "Para quem você deve?" e "Quanto você deve hoje".
  - "Conta padrão" virou "Usar nos novos lançamentos"; cor, moeda, "Não somar nos totais" e observação ficaram em **Mais opções**.
- **Novo:** "Compras que já estão no cartão", no cadastro do cartão e na tela do cartão:
  - **Compra parcelada:** informe em quantas vezes e qual parcela vem na fatura; o app lança só as parcelas que faltam, uma por mês, como despesas do cartão.
  - **Compra à vista:** lançada como despesa na fatura escolhida.
  - **Valor da fatura (sem detalhar as compras):** entra na fatura e no limite usado, mas não conta como despesa do mês.
  - Se uma fatura acabou de fechar e ainda venceu, dá para escolher em qual fatura cada item está.
- **Melhoria:** no cadastro de despesa, "Pago com" (ou "Recebido em") separa cartões e contas, mostra o limite disponível de cada cartão e tem atalho para criar conta ou cartão. Com um cartão escolhido, o valor mostra o disponível e em qual fatura a compra entra.
- **Correção:** ao marcar "Repetir", o botão ficava cortado no canto da tela do celular. Data e conta agora ficam lado a lado e Repetir, Parcelas, Tags, Observações e Anexos viraram uma barra de botões de largura fixa.
- Novos cartões não usam mais a "Dívida atual" solta (que não entrava em nenhuma fatura); cartões antigos com esse valor o mostram em Mais opções.

## 5.2 — Cadastro pelo widget

- **Melhoria:** widget novo "Cadastro rápido", tamanho 3×2 (6 blocos): gastos do mês, botões Despesa e Receita e atalhos das 3 categorias que você mais usa.
- **Melhoria:** os botões de todos os widgets abrem uma **mini tela** por cima da tela inicial (sem abrir o app inteiro): tipo, valor no teclado-calculadora, categoria e conta. Ao salvar, ela fecha sozinha e o widget já mostra o novo total.
- **Melhoria:** na mini tela, "Mais opções no app" leva o que foi digitado para o cadastro completo (tags, observações, anexos, parcelas, repetir).
- O Android não permite campos de digitação dentro do próprio widget; a mini tela é a forma de cadastrar sem sair da tela inicial.

## 5.1 — Novidades da atualização

- **Melhoria:** ao abrir uma versão nova, o app mostra uma vez o que mudou desde a versão que você usava (quem vem da 1.0 vê tudo de 1.1 a 5.1). Instalações novas não mostram o aviso.
- **Melhoria:** botão "Ver todas as versões" leva ao histórico completo em *Perfil › Sobre o app › Novidades*.
- Um teste automático garante que o changelog do app, este arquivo e a versão do `package.json` andam juntos.

## 5.0 — Widgets

- **Novo:** widget “Lançamento rápido” (2×1) com os botões Despesa e Receita na tela inicial do celular.
- **Novo:** widget “Resumo do mês” (4×2) com gastos, receitas e saldo do mês, além dos botões.
- **Melhoria:** os widgets escondem os valores quando “Ocultar valores” ou o bloqueio do app estão ativos.
- Os widgets podem ser adicionados em *Perfil › Widgets e atalhos* ou pela tela inicial do celular.

## 4.0 — Metas

- **Novo:** metas de economia com nome, ícone, cor, valor-alvo e data opcional (*Perfil › Metas*).
- **Novo:** botões Guardar e Retirar, histórico de movimentações e anel de progresso.
- **Novo:** sugestão de quanto guardar por mês para chegar na data e previsão de quando a meta será alcançada no ritmo atual.
- **Novo:** comemoração ao alcançar a meta; metas podem ser arquivadas.

## 3.0 — Cartões de crédito

- **Novo:** lista oficial de bancos do Banco Central (469 instituições, 158 logos) via pacote `logos-bancos-br`, para escolher o banco do cartão ou de qualquer conta.
- **Novo:** cartão com limite, dia de fechamento e dia de vencimento; tela do cartão com limite usado/disponível, fatura do mês com status (aberta, fechada, paga, vencida), próximas faturas e compras da fatura.
- **Novo:** compras parceladas (até 48x): cada parcela é lançada no seu mês e a 1ª fica com o arredondamento.
- **Novo:** “Pagar fatura” abre uma transferência já preenchida com o valor em aberto; “Nova compra” abre o cadastro no cartão.
- **Novo:** excluir uma parcela, esta e as próximas, ou todas.
- **Melhoria:** a lista de cartões fica em *Perfil › Cartões de crédito*.

## 2.0 — Tags, observações e anexos

- **Novo:** tags nos lançamentos, criadas na hora e com cor; tela *Perfil › Tags* para renomear, recolorir, ordenar e excluir.
- **Novo:** campo “Observações” para texto longo, além da descrição curta.
- **Melhoria:** “Anexos” visível no cadastro: foto na hora pela câmera ou da galeria.
- **Melhoria:** busca por tag e por observações; tags e observações também saem na exportação (Excel, CSV, JSON).
- Backup no formato 2 (inclui tags e metas); backups antigos continuam sendo restaurados.

## 1.6 — Repetir no cadastro

- **Novo:** botão “Repetir” no cadastro de despesa, receita e transferência (diário até anual, com número de vezes).
- **Correção:** o lançamento recorrente aparece na lista assim que é cadastrado; na tela de Recorrentes, a opção “Registrar desde a primeira data” lança na hora as datas que já chegaram.

## 1.5 — Gráfico de pizza

- **Melhoria:** gráfico de pizza (rosca) por categoria em Gráficos, com até 5 categorias + “Outros”; tocar numa fatia mostra nome, valor e %, e tocar de novo abre os lançamentos.

## 1.4 — Dicas nos ícones

- **Melhoria:** tocar e segurar um ícone mostra um balão com o que ele faz (sem acionar o botão).

## 1.3 — Atalhos na tela do celular

- **Correção:** “criar atalho na tela inicial” agora coloca um ícone de verdade na tela do celular (*Perfil › Widgets e atalhos*): Nova despesa, Nova receita, Buscar, Jardim, Metas e Cartões. O Jardim também tem esse botão na própria tela.
- **Melhoria:** tocar e segurar o ícone do Cofrinho mostra Nova despesa, Nova receita e Buscar.
- Os antigos interruptores “Atalho do calendário/jardim” só mostravam um ícone no topo da tela Início do app; foram renomeados para deixar isso claro.

## 1.2 — Confirmar saída

- **Correção:** o botão voltar na tela Início pergunta “Sair do Cofrinho?” antes de fechar o app.

## 1.1 — Voltar no cadastro

- **Correção:** no cadastro de despesa/receita, o voltar primeiro esconde o teclado de valores (aparece o botão Salvar e mais espaço para as categorias); tocar no valor mostra o teclado de novo.
- **Melhoria:** se algo foi preenchido, o app pergunta antes de descartar o lançamento.

## 1.0 — Primeira versão

- Despesas, receitas e transferências; contas, orçamentos, recorrentes, lembretes, calendário, gráficos, relatórios, busca, importação/exportação, livro dividido, backup, temas, bloqueio e jardim da sorte.

## Próximas versões (planejadas)

- **6.0** — Investimentos com regra de rendimento e projeção no tempo.
- **7.0** — Assistente de IA com a API do Gemini (camada gratuita, com limite de uso).
- **7.1** — Desafios simples sugeridos pela IA (ex.: 10 dias sem delivery).
- **8.0** — Backup e restauração direto no Google Drive.
