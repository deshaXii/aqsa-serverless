export const calculateProfit = (repairPrice, parts) => {
  const totalPartsCost = (parts || []).reduce(
    (sum, p) => sum + (Number(p.cost) || 0),
    0
  );
  const profit = (repairPrice || 0) - totalPartsCost;
  return { totalPartsCost, profit };
};
