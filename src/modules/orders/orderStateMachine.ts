const transitions: any = {
  ORDER_RECEIVED: ["ORDER_RECEIVED"],
  PREPARING: ["PREPARING"],
  READY: ["READY"],
  COMPLETED: ["COMPLETED"],
};

export const canTransition = (current: string, next: string) => {
  return transitions[current]?.includes(next);
};
