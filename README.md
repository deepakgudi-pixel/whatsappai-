# 📱 Personal AI WhatsApp Assistant

![Status: Deployed](https://img.shields.io/badge/Status-Deployed-success?style=for-the-badge)
![Tech: Node.js](https://img.shields.io/badge/Tech-Node.js-339933?style=for-the-badge&logo=nodedotjs)
![Tech: LLaMA 3.3](https://img.shields.io/badge/LLM-LLaMA_3.3-0466C8?style=for-the-badge)
![Security: High](https://img.shields.io/badge/Privacy-RAM_Only-red?style=for-the-badge)

A highly secure, context-aware WhatsApp automation engine designed to act as a personal proxy. Built with **Node.js**, **Puppeteer**, and **Groq Cloud (LLaMA 3.3 70B)**, this system manages personal communications, enforces rate limits, and prioritizes data privacy through volatile-memory session management.


---

## 🏗️ System Architecture

The application acts as a middleman between WhatsApp Web and the Groq LLM API, ensuring all messages are filtered, verified, and logged before any inference occurs.

```mermaid
graph TD
    User([WhatsApp Contact]) -->|Incoming Message| Bridge(whatsapp-web.js Bridge)
    Bridge --> Engine{Node.js Logic Engine}
    
    %% Gatekeeping
    Engine -->|Blocked Number| Drop[🛑 Silent Drop]
    Engine -->|Group Chat / Status| Drop
    
    %% Overrides
    Engine -->|Owner Reply Detected| Cooldown[⏱️ Trigger 24h AI Mute]
    
    %% Processing
    Engine -->|Approved Direct Message| Session[Session Manager]
    Session -->|Check Daily Quota| RateLimit{Limit Reached?}
    RateLimit -->|Yes| Reject[Send Quota Alert]
    RateLimit -->|No| Prompt[Construct Context + History]
    
    %% LLM Call
    Prompt --> Groq((Groq API: LLaMA 3.3))
    Groq -->|Inference Reply| Session
    Session --> Bridge
    Bridge -->|AI Response| User
    
    %% Keep Alive
    Cron((Cron-job.org)) -.->|15 Min Heartbeat| Server[Express Health Server]
