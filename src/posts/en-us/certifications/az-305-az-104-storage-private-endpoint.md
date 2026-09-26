---
title: "AZ-305 / AZ-104: Private Endpoint or Service Endpoint for Azure Storage?"
description: "A simulated exam question on private Storage access: the IP address, not just the traffic path, decides the answer."
date: "2026-09-26"
exam: "AZ-305 / AZ-104"
kind: "question"
videoEmbed: "https://www.linkedin.com/embed/feed/update/urn:li:ugcPost:7426370058035236864?compact=1"
sourceUrl: "https://www.linkedin.com/posts/gsantana-s_quest%C3%A3ozinha-simulada-para-az-305-az-104-activity-7426370267280752640-_gyV"
---

## The clue is the destination IP

In the video, App1 reads data from an Azure Storage account. The simulated question asks for a network solution that keeps the traffic on Microsoft's private backbone **and gives access to the Storage resource through a private IP inside the VNet**. The choices are Private Endpoint, Service Endpoint with a Service Endpoint Policy, ExpressRoute with Microsoft Peering, and Virtual Network Gateway.

**Private Endpoint is the answer.** Both Private Endpoint and Service Endpoint can keep traffic on the Microsoft backbone. Only the former creates a private destination IP in the VNet for this Storage connection. That second requirement is what settles the question; "the traffic stays on Microsoft's network" alone does not.

## What Private Endpoint actually creates

An Azure Private Endpoint is a network interface in a subnet of your VNet. It receives an IP from that subnet and connects to a particular Azure resource through Private Link. For Storage, the client still uses the normal account hostname, but [private DNS resolves it to the endpoint's private IP](https://learn.microsoft.com/en-us/azure/storage/common/storage-private-endpoints). Traffic then crosses the Microsoft backbone to that Storage service without using the public internet.

That wording matters: the private IP belongs to the **endpoint network interface**, not to every Storage service or to the account's public endpoint. Storage exposes separate subresources, so an application that uses Blob Storage needs a `blob` private endpoint; one that also uses Files or Queues needs endpoints for those services too. Microsoft's [Storage Private Endpoint guide](https://learn.microsoft.com/en-us/azure/storage/common/storage-private-endpoints) lists the corresponding DNS zones, including `privatelink.blob.core.windows.net`.

## Why the other three do not satisfy this question

- **Service Endpoint + Service Endpoint Policy:** a serious alternative, not a joke answer. A [service endpoint](https://learn.microsoft.com/en-us/azure/virtual-network/virtual-network-service-endpoints-overview) routes subnet traffic to Azure Storage over Microsoft's backbone, and the [policy](https://learn.microsoft.com/en-us/azure/virtual-network/virtual-network-service-endpoint-policies-overview) can restrict which Storage accounts that subnet reaches. But the Storage destination still resolves to a publicly routable IP. No private IP is created for the account inside the VNet. If the question had only asked to restrict access from a subnet, this option would deserve consideration; it fails the explicit private-destination-IP requirement.
- **ExpressRoute (Microsoft Peering):** a connectivity path from an on-premises network to Microsoft services using their public IP addresses. It does not put a Storage Private Endpoint into App1's VNet. If a hybrid client needs to reach a private endpoint, [ExpressRoute private peering or VPN can carry that traffic to the VNet](https://learn.microsoft.com/en-us/azure/storage/common/storage-private-endpoints), but the endpoint is still a separate resource.
- **Virtual Network Gateway:** connects networks, such as an on-premises site and an Azure VNet. It is not a per-Storage-resource interface and does not by itself make the Storage hostname resolve to a private IP.

## The production version of the answer

Passing the exam is one thing; making the architecture genuinely private takes a few more steps:

1. Create a Private Endpoint for each Storage subresource App1 actually uses, starting with `blob` if App1 reads blobs.
2. Integrate the appropriate private DNS zone with the VNet. From App1's network, verify that the *usual* Storage hostname resolves to the private endpoint IP; don't hard-code an IP in the application.
3. If all clients can use Private Link, [disable public network access on the Storage account](https://learn.microsoft.com/en-us/azure/storage/common/storage-network-security-set-default-access). Creating a Private Endpoint alone does **not** turn off the public endpoint.
4. Keep authorization separate from network isolation: use the right Microsoft Entra identity and data permissions. Reaching Storage privately does not grant access to its data.

That is the exam habit I am practicing here: read every word of the requirement, then distinguish **where traffic travels** from **what address the client connects to**. AZ-104 covers configuring both endpoint types; AZ-305 asks you to select the right design for the constraint ([AZ-104 study guide](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/az-104), [AZ-305 study guide](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/az-305)).
