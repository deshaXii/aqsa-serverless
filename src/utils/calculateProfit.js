// utils/calculateProfit.js
function calculateProfit(price, parts) {
  const totalPartsCost = parts.reduce((sum, part) => sum + (part.cost || 0), 0);
  const profit = (price || 0) - totalPartsCost;
  return { totalPartsCost, profit };
}

module.exports = { calculateProfit };
