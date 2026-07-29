import { ScanBarcodeScreen } from "@/components/log/scan-barcode-screen";

/**
 * Modal route for barcode scanning, reached from the add-food screen's
 * "barcode" input method. Replaces itself with the food detail (found) or the
 * create form (not found), so a scan never leaves a dead screen behind.
 */
export default function ScanBarcodeRoute() {
  return <ScanBarcodeScreen />;
}
