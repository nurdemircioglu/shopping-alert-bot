#!/bin/zsh
# launchd işi (com.shoppingalert.kupon) her 10 dakikada bunu çalıştırır.
# Token Anahtar Zinciri'nden okunur (shopping-alert / telegram); hiçbir yere yazılmaz.
cd "$(dirname "$0")"
export PATH=/usr/local/bin:/usr/bin:/bin
export TELEGRAM_BOT_TOKEN=$(security find-generic-password -s shopping-alert -a telegram -w 2>/dev/null)
export TELEGRAM_KANAL_ID=@shoppingalerttr TELEGRAM_CHAT_ID=1510428430
[[ -z "$TELEGRAM_BOT_TOKEN" ]] && echo "UYARI: Anahtar Zinciri'nde token yok, bildirim gönderilmeyecek"
# Önceki tur hâlâ sürüyorsa bu turu atla
KILIT=/tmp/shoppingalert-kupon.lock
if ! mkdir "$KILIT" 2>/dev/null; then echo "$(date '+%F %T') önceki tur sürüyor, atlandı"; exit 0; fi
trap 'rmdir "$KILIT"' EXIT
echo "=== $(date '+%Y-%m-%d %H:%M:%S') ==="
node magazalar-test.js --headful --yalniz=Koton
