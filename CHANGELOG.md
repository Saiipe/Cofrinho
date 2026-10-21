# Novidades do Cofrinho

Esquema de versão:

- **Primeiro número** — funcionalidades importantes (2.0, 3.0…).
- **Segundo número** — correções, melhorias e funcionalidades simples (1.1, 1.2…).

O mesmo histórico aparece no app em *Perfil › Sobre o app › Novidades* (`src/changelog.ts`) e, depois de cada atualização, num aviso com o que mudou desde a versão que estava instalada.

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
