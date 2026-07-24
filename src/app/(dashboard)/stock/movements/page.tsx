'use client';

import { Card, CardContent } from '@/components/ui/card';
import { MovementForm } from '@/components/features/stock/MovementForm';

export default function StockMovementsPage() {
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <Card>
        <CardContent className="p-4 md:p-6">
          <MovementForm />
        </CardContent>
      </Card>
      <p className="text-center text-xs text-text-secondary">
        Foto barang bersifat opsional namun disarankan sebagai bukti.
      </p>
    </div>
  );
}
