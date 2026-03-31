export const countOccurrences = (
  data: { name: string }[] | { name: string }[][],
) => {
  return data.flat().reduce<Record<string, number>>((acc, item) => {
    const name = item?.name;
    acc[name] = acc[name] ? acc[name] + 1 : 1;
    return acc;
  }, {});
};
