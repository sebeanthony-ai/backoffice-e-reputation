#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

echo "🚀 Démarrage du Back Office E-Réputation..."

# Start backend
echo "▶ Backend API sur http://localhost:3001"
cd "$(dirname "$0")/backend" && node src/index.js &
BACKEND_PID=$!

sleep 2

# Start frontend
echo "▶ Frontend sur http://localhost:5173"
cd "$(dirname "$0")/frontend" && npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ Application démarrée !"
echo "📊 Ouvrir : http://localhost:5173"
echo ""
echo "Ctrl+C pour arrêter"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
