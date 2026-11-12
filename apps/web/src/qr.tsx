import qrcode from 'qrcode-generator';
import { useMemo } from 'react';

/** QR code em SVG gerado no navegador, para entrar na mesa pelo celular. */
export function QrCode({ text, label }: { text: string; label: string }) {
  const svg = useMemo(() => {
    const code = qrcode(0, 'M');
    code.addData(text);
    code.make();
    return code.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  }, [text]);
  return (
    <div className="qr" role="img" aria-label={label} dangerouslySetInnerHTML={{ __html: svg }} />
  );
}
