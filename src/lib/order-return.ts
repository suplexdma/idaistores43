export const RETURN_DELIVERY_LOSS_PKR = 300;

export function calculateOrderFinancials({
  grossRevenue,
  originalProductProfit,
  returnedProductProfit,
  returnedOrders,
}: {
  grossRevenue: number;
  originalProductProfit: number;
  returnedProductProfit: number;
  returnedOrders: number;
}) {
  const returnLoss = returnedOrders * RETURN_DELIVERY_LOSS_PKR;
  return {
    grossRevenue,
    returnLoss,
    netProfit: originalProductProfit - returnedProductProfit - returnLoss,
  };
}
