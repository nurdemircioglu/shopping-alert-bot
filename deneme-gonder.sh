#!/bin/zsh
# Deneme mesajını gönderir. Bot token'ı Anahtar Zinciri'nde (shopping-alert / telegram) yoksa
# gizli sorar (ekranda görünmez), biçimini kontrol eder ve sonraki çalışmalar için oraya kaydeder.
cd "$(dirname "$0")"
gecerli() { [[ "$1" =~ '^[0-9]+:[A-Za-z0-9_-]{30,}$' ]] }
TELEGRAM_BOT_TOKEN=$(security find-generic-password -s shopping-alert -a telegram -w 2>/dev/null)
if ! gecerli "$TELEGRAM_BOT_TOKEN"; then
  while true; do
    read -rs "TELEGRAM_BOT_TOKEN?Bot token'ını yapıştır (Cmd+V) ve Enter'a bas — ekranda görünmeyecek: "; echo
    TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN//[[:space:]]/}
    if gecerli "$TELEGRAM_BOT_TOKEN"; then echo "✓ Token alındı (${#TELEGRAM_BOT_TOKEN} karakter)"; break; fi
    echo "✗ Token alınamadı (${#TELEGRAM_BOT_TOKEN} karakter geldi). Token 123456789:ABC... biçiminde olmalı, tekrar dene."
  done
  security add-generic-password -U -s shopping-alert -a telegram -w "$TELEGRAM_BOT_TOKEN" && echo "✓ Anahtar Zinciri'ne kaydedildi"
fi
export TELEGRAM_BOT_TOKEN TELEGRAM_KANAL_ID=@shoppingalerttr TELEGRAM_CHAT_ID=1510428430
node deneme-bildirim.js
