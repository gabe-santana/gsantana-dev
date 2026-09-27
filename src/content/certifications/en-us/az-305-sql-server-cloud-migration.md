---
title: "AZ-305: migrating SQL Server, SSIS, SSAS, and SSRS to Azure"
description: "An exam question walkthrough: why a VM wins when the entire SQL Server ecosystem needs to move together."
date: "2026-09-26"
exam: "AZ-305"
kind: "question"
videoEmbed: "https://www.linkedin.com/embed/feed/update/urn:li:ugcPost:7426384760459087872?compact=1"
sourceUrl: "https://www.linkedin.com/feed/update/urn:li:ugcPost:7426384760459087872/"
---

## The question is bigger than a database

In the video, I work through a simulated AZ-305 scenario: an on-premises solution runs the SQL Server Database Engine **and** three BI services: Integration Services (SSIS), Analysis Services (SSAS), and Reporting Services (SSRS). The goal is to migrate to Azure with minimal time and migration effort, without paying to rebuild the whole solution unnecessarily. The choices are Azure SQL Database, Azure SQL Managed Instance, Azure Synapse Analytics, and SQL Server on Azure Virtual Machines.

This is not simply a question about where to put a database. If it were, the PaaS options would be more compelling. The deciding detail is the other three services. Read the requirement as a **complete solution**, not just a `.bak` file, and the answer becomes much clearer.

## Why a VM is the best fit

**SQL Server on an Azure VM** is the closest match to the existing environment. It supports a *rehost* (lift-and-shift) strategy: move the solution first with relatively few changes, then modernize if the business case justifies it. [Microsoft's migration overview](https://learn.microsoft.com/en-us/data-migration/sql-server/virtual-machines/overview) specifically covers moving SSIS, SSRS, and SSAS to an Azure VM. Its lift-and-shift guidance says those BI services require no additional migration steps in that approach.

That is why I choose the VM in the video. The [official Azure SQL migration FAQ](https://learn.microsoft.com/en-us/azure/azure-sql/migration-guides/modernization?view=azuresql) reaches the same conclusion for BI workloads that are incompatible with Managed Instance: hosting the components on an Azure VM is the lowest-effort path.

## Why the other choices fall short

- **Azure SQL Database:** a strong managed relational database, but not a single host for the existing SSIS, SSAS, and SSRS services. Keeping the full solution would mean redesigning it or spreading its components across other services.
- **Azure SQL Managed Instance:** closer to the traditional SQL Server database engine, but it does not run SSAS or the SSRS service inside the instance. There is an important nuance: it can host the SSRS catalog database, and Azure Data Factory offers a route for SSIS packages. That is not the same as moving the entire existing solution without changes. The [Microsoft migration FAQ](https://learn.microsoft.com/en-us/azure/azure-sql/migration-guides/modernization?view=azuresql) spells out the distinction.
- **Azure Synapse Analytics:** designed for analytical and data warehouse workloads. It is not a direct lift-and-shift target for the transactional engine plus all three BI services in this scenario.

The useful exam habit is to **inventory every dependency before choosing a destination**. The [AZ-305 study guide](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/az-305) explicitly covers evaluating IaaS and PaaS migrations, not automatically preferring one model.

## The real-world caveat

Lower cost **to migrate** is not necessarily lower cost **to operate**. A VM still needs sizing, OS maintenance, patching, licensing, backups, availability planning, and monitoring. I would inventory databases, SSIS packages, SSAS models, SSRS reports, logins, jobs, and integrations, then measure actual utilization, allowable downtime, and total cost. [Microsoft's SQL VM migration guidance](https://learn.microsoft.com/en-us/data-migration/sql-server/virtual-machines/overview) covers these planning choices and migration methods.

If modernization is a later goal, integration, analytical models, and reports can be evaluated separately. But that is **another project**, with a different timeline and risk profile. For this question, which asks to move the complete solution with the least migration work, the answer remains **SQL Server on Azure Virtual Machines**.
