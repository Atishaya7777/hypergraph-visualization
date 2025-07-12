export async function parseTextFile(file: File): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split('\n').map(x => x.trim()));
    reader.onerror = reject;
    reader.readAsText(file);
  });
}
