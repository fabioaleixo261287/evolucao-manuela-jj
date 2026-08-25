# Guia de demonstracao - Alliance Kids

Este pacote usa somente dados ficticios. O backup original `backup_eagle_25-08-2026.json` nao foi alterado.

## Arquivo recomendado

Importe `backup_demo_rede_completa_98_alunos.json` para testar o Painel Central e as duas unidades.

## Abertura automática local (recomendado)

Abra `http://127.0.0.1:4175/?demo=1` para carregar automaticamente a demonstração completa.

Esse endereço utiliza armazenamento isolado e mantém Appwrite e a produção desconectados. Não é necessário importar o JSON manualmente. A cada abertura com `?demo=1`, o pacote validado é restaurado com:

- 98 alunos fictícios;
- 52 alunos na Alliance Mooca;
- 46 alunos na Alliance Teste;
- 2 unidades;
- 3 usuários do sistema;
- alertas, mensagens, desafios, presenças e históricos de graduação.

Antes da importacao, gere um backup da base atualmente aberta. A importacao substitui os alunos, arquivos e usuarios exibidos no navegador.

## Acessos do professor

| Unidade | Usuario | Senha |
| --- | --- | --- |
| Alliance Mooca | `prof.mooca` | `Demo@2026` |
| Alliance Teste | `prof.teste` | `Demo@2026` |

O administrador permanece com o acesso presente no backup original.

## Alunos com historico completo

### Alliance Mooca

- Aluna: `Laura Demonstracao Mooca`
- Nome gravado no sistema: `Laura Demonstração Mooca`
- Nascimento: `25/08/2019`
- Senha no acesso dos pais: `25082019`
- Faixa atual: `Amarela`
- Sequencia: Branca, Cinza/Branca, Cinza, Cinza/Preta, Amarela/Branca e Amarela
- Tambem demonstra: aniversario do dia, mensagem pendente, desafio ativo e Top Frequencia

### Alliance Teste

- Aluno: `Miguel Demonstracao Teste`
- Nome gravado no sistema: `Miguel Demonstração Teste`
- Nascimento: `25/08/2018`
- Senha no acesso dos pais: `25082018`
- Faixa atual: `Amarela`
- Sequencia: Branca, Cinza/Branca, Cinza, Cinza/Preta, Amarela/Branca e Amarela
- Tambem demonstra: aniversario do dia, mensagem pendente, desafio ativo e Top Frequencia

## Alertas - Alliance Mooca

| Cenario | Aluno |
| --- | --- |
| Aniversariante do dia | Alice Almeida Castro |
| Sem presenca ha 7 dias ou mais | Bernardo Cardoso Martins |
| Desafio vencido | Beatriz Costa Ramos |
| Desafio ativo | Caio Freitas Almeida |
| Pronto para exame | Camila Martins Dias |
| Mensagem nao lida | Enrico Moreira Monteiro |
| Autorizacao de imagem pendente | Cecilia Pereira Rocha |
| Saida registrada no mes | Gabriel Rocha Barbosa |
| Historico completo e Top Frequencia | Laura Demonstração Mooca |

## Alertas - Alliance Teste

| Cenario | Aluno |
| --- | --- |
| Aniversariante do dia | Camila Rodrigues Alves |
| Sem presenca ha 7 dias ou mais | Enrico Souza Ferreira |
| Desafio vencido | Cecilia Barbosa Moreira |
| Desafio ativo | Gabriel Castro Rodrigues |
| Pronto para exame | Eduarda Ferreira Cardoso |
| Mensagem nao lida | Gustavo Lima Gomes |
| Autorizacao de imagem pendente | Eloa Monteiro Oliveira |
| Saida registrada no mes | Henrique Oliveira Silva |
| Historico completo e Top Frequencia | Miguel Demonstração Teste |

## Conteudo validado

- aniversariantes do dia e do mes;
- alunos ativos sem presenca ha pelo menos 7 dias;
- mensagens nao lidas;
- desafios ativos e vencidos;
- alunos prontos para exame;
- autorizacao de imagem pendente;
- entrada e saida no mes para o BI central;
- frequencia no mes e Top Frequencia;
- alunos ativos, experimentais, pausados e inativos;
- historico completo de graduacoes da faixa Branca ate a Amarela.
