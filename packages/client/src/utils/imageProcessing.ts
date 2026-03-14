export interface ProcessedImage {
  dataUrl: string;
  width: number;
  height: number;
}

export function processDroppedImage(file: File): Promise<ProcessedImage> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const MAX_DIM = 3840;
        if (w > MAX_DIM || h > MAX_DIM) {
          const scale = MAX_DIM / Math.max(w, h);
          const nw = Math.round(w * scale);
          const nh = Math.round(h * scale);
          const canvas = document.createElement('canvas');
          canvas.width = nw;
          canvas.height = nh;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, nw, nh);
          resolve({ dataUrl: canvas.toDataURL('image/png'), width: nw, height: nh });
        } else {
          resolve({ dataUrl, width: w, height: h });
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}
