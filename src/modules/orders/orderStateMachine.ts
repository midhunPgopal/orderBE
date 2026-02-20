const transitions: any = {
  PLACED: ["CONFIRMED"],
  CONFIRMED: ["PREPARING"],
  PREPARING: ["READY"],
  READY: ["OUT_FOR_DELIVERY"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
};

export const canTransition = (current: string, next: string) => {
  return transitions[current]?.includes(next);
};
