---
title: "AZ-305: como migrar SQL Server, SSIS, SSAS e SSRS para o Azure?"
description: "Uma questão comentada de migração para a nuvem: por que a VM vence quando todo o ecossistema SQL Server precisa ir junto."
date: "2026-09-26"
exam: "AZ-305"
kind: "question"
videoEmbed: "https://www.linkedin.com/embed/feed/update/urn:li:ugcPost:7426384760459087872?compact=1"
sourceUrl: "https://www.linkedin.com/feed/update/urn:li:ugcPost:7426384760459087872/"
---

## A questão, sem decorar a resposta

No vídeo, comento um cenário simulado do AZ-305: uma solução local usa o mecanismo de banco de dados do SQL Server **e** três serviços de BI: Integration Services (SSIS), Analysis Services (SSAS) e Reporting Services (SSRS). A migração deve acontecer com o menor esforço e tempo possíveis, sem criar uma conta desnecessária para reconstruir tudo. As alternativas são Azure SQL Database, Azure SQL Managed Instance, Azure Synapse Analytics e SQL Server em máquinas virtuais do Azure.

A pergunta não é simplesmente "onde colocar um banco de dados?". Se fosse, as opções PaaS ficariam muito mais atraentes. O detalhe que decide a arquitetura está nos outros três serviços. Ler o enunciado como uma **solução completa**, e não como um arquivo `.bak`, evita a pegadinha.

## Por que a VM é a melhor resposta aqui

**SQL Server em uma VM do Azure** preserva o ambiente mais próximo do que já existe. É uma estratégia de *rehost* (lift and shift): primeiro levar a solução para a nuvem com poucas mudanças; modernizar depois, se fizer sentido. A [documentação de migração da Microsoft](https://learn.microsoft.com/en-us/data-migration/sql-server/virtual-machines/overview) é explícita ao listar SSIS, SSRS e SSAS entre os componentes que podem acompanhar essa migração. Também descreve um caminho de lift and shift que não exige etapas adicionais para migrar esses serviços de BI.

É por isso que marco a alternativa da VM no vídeo. A [FAQ oficial de migração do Azure SQL](https://learn.microsoft.com/en-us/azure/azure-sql/migration-guides/modernization?view=azuresql) chega à mesma conclusão para workloads de BI que não são compatíveis com Managed Instance: hospedar os componentes em uma VM é o caminho de menor esforço.

## Eliminando as outras alternativas

- **Azure SQL Database:** ótimo quando a necessidade é um banco relacional gerenciado, mas não hospeda, como um pacote único, SSIS, SSAS e SSRS. Para manter as funções da solução, seria preciso redesenhar ou distribuir componentes entre outros serviços.
- **Azure SQL Managed Instance:** aproxima o mecanismo de banco do SQL Server tradicional, mas não executa SSAS e o serviço SSRS dentro da instância. Há uma nuance: ela pode hospedar o banco de catálogo do SSRS, e o Azure Data Factory oferece um caminho para pacotes SSIS. Isso não significa que toda a solução atual roda ali sem mudanças. A [FAQ da Microsoft](https://learn.microsoft.com/en-us/azure/azure-sql/migration-guides/modernization?view=azuresql) distingue essas possibilidades.
- **Azure Synapse Analytics:** atende cenários analíticos e de data warehouse. Não é uma substituição direta para migrar, como estão, o mecanismo transacional e os três serviços de BI do enunciado.

O atalho mental para a prova é: **identifique todas as dependências antes de escolher o destino**. A [matriz de habilidades do AZ-305](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/az-305) cobra justamente a avaliação de migrações para IaaS e PaaS, não uma preferência automática por um dos dois.

## A ressalva que importa fora da prova

Menor custo **para migrar** não é sinônimo de menor custo **para operar**. Uma VM traz responsabilidade por dimensionamento, sistema operacional, patches, licenciamento, backup, disponibilidade e observabilidade. Eu começaria inventariando bancos, pacotes SSIS, modelos SSAS, relatórios SSRS, logins, jobs e integrações; depois mediria uso real, janela de indisponibilidade e custo total. A [orientação da Microsoft sobre VMs SQL](https://learn.microsoft.com/en-us/data-migration/sql-server/virtual-machines/overview) trata esses pontos de planejamento e dos diferentes métodos de migração.

Se a meta futura for modernizar, é possível estudar alternativas separadas para integração de dados, modelos analíticos e relatórios. Mas isso é **outro projeto**, com outra estimativa de tempo e risco. Para esta questão, que pede levar a solução inteira com o mínimo de trabalho de migração, a resposta continua sendo **SQL Server em máquinas virtuais do Azure**.
