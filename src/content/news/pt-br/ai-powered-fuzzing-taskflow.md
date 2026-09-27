---
title: GitHub explora agentes de IA para as partes difíceis do fuzzing
summary: 'Um agente do Security Lab mira lacunas de cobertura, novos harnesses e triagem de falhas no fuzzing contínuo.'
date: '2026-09-24'
order: 1
category: security
publisher: GitHub Security Lab
sourceUrl: 'https://github.blog/security/application-security/ai-powered-fuzzing-with-the-github-security-lab-taskflow-agent/'
image: /news/ai-powered-fuzzing-taskflow/cover.webp
sources:
  - url: 'https://github.com/GitHubSecurityLab/seclab-taskflows-fuzzing'
    label: Repositório do fluxo de fuzzing do Security Lab
  - url: 'https://google.github.io/oss-fuzz/advanced-topics/code-coverage/'
    label: 'OSS-Fuzz: medição da cobertura de código'
lead:
  - 'O fuzzing contínuo ainda precisa de pessoas para acompanhar a cobertura, escrever harnesses para código não alcançado e investigar falhas. O GitHub Security Lab descreve um fluxo baseado em seu framework de agentes para explorar quanto desse trabalho pode ser assumido por um agente de linguagem.'
  - 'O relato parte das tarefas reais por trás do fuzzing, sem tratar o agente como solução completa de segurança. Ele é especialmente relevante para mantenedores que já executam fuzzers, mas têm dificuldade para ampliar a cobertura.'
---

## O trabalho entre executar e encontrar

Um fuzzer pode rodar por semanas e quase não alcançar o código que importa. O [guia de cobertura do OSS-Fuzz](https://google.github.io/oss-fuzz/advanced-topics/code-coverage/) recomenda medir quais caminhos os alvos realmente exercitam. Essa é a lacuna abordada pelo [relato do Security Lab](https://github.blog/security/application-security/ai-powered-fuzzing-with-the-github-security-lab-taskflow-agent/): cobertura, criação de harnesses e triagem de falhas exigem decisões, não apenas tempo de CPU.

O [repositório aberto](https://github.com/GitHubSecurityLab/seclab-taskflows-fuzzing) descreve um pipeline para projetos C/C++ nativos com AFL++, clang, ferramentas de cobertura e um corpus persistente. A documentação também apresenta limitações e requisitos de instalação. A hipótese a testar não é que o agente torna o fuzzing automático, mas se ele consegue melhorar uma campanha depois do primeiro harness.

## A leitura responsável

Trate harnesses gerados e relatórios de vulnerabilidade como pistas. Confira se o harness alcança caminhos relevantes, se a falha é reproduzível e se a correção proposta elimina o problema sem alterar o comportamento desejado. Automação de segurança conquista confiança com evidências reproduzíveis; um resumo confiante não basta.
