import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { ApiError, getFoodByBarcode } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { Radius, Spacing, useTheme } from '@/theme';

import { formatGtin, normalizeGtin } from '@metabolizm/shared';

import type { BarcodeScanningResult, BarcodeType } from 'expo-camera';

/**
 * Retail barcode symbologies only. QR and the 2D formats are deliberately
 * absent — nothing on a grocery shelf identifies a product with one, and
 * accepting them just invites confusing misfires from posters and packaging
 * marketing codes.
 */
const BARCODE_TYPES: BarcodeType[] = ['ean13', 'ean8', 'upc_a', 'upc_e', 'itf14'];

type Outcome =
  | { kind: 'scanning' }
  | { kind: 'looking_up'; code: string }
  | { kind: 'not_found'; code: string }
  /**
   * A supermarket's own weight/price label. Distinct from not-found on
   * purpose: there is no global product behind these digits, so no database
   * will ever have it. Told "not found", a user rescans the same label over
   * and over.
   */
  | { kind: 'store_local' }
  | { kind: 'unreadable' }
  | { kind: 'error'; message: string };

/**
 * Barcode scanning. NZ/AU coverage in every open food database is thin
 * (Open Food Facts holds only ~15k NZ products), so "scan → not found → add
 * it" is a PRIMARY flow rather than an edge case — which is why the not-found
 * state is framed as an invitation rather than a failure.
 */
export function ScanBarcodeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'scanning' });
  // The camera fires continuously while a barcode is in frame; this latch is
  // what stops one scan becoming dozens of lookups.
  const busy = useRef(false);

  const onScanned = ({ data }: BarcodeScanningResult) => {
    if (busy.current) return;
    busy.current = true;

    // Normalised on-device first, so an unreadable scan or a store label never
    // becomes a request at all.
    const result = normalizeGtin(data);
    if (result.kind === 'store_local') {
      haptics.select();
      setOutcome({ kind: 'store_local' });
      return;
    }
    if (result.kind === 'invalid') {
      setOutcome({ kind: 'unreadable' });
      // A bad read is usually a bad angle, so allow an immediate retry.
      busy.current = false;
      return;
    }

    haptics.select();
    setOutcome({ kind: 'looking_up', code: result.value });
    getFoodByBarcode(result.value)
      .then((food) => {
        haptics.success();
        router.replace({ pathname: '/food-detail', params: { foodId: food.id } });
      })
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 404) {
          setOutcome({ kind: 'not_found', code: result.value });
        } else if (e instanceof ApiError && e.status === 422) {
          setOutcome({ kind: 'store_local' });
        } else {
          setOutcome({
            kind: 'error',
            message: e instanceof Error ? e.message : 'Lookup failed.',
          });
        }
      });
  };

  const rescan = () => {
    busy.current = false;
    setOutcome({ kind: 'scanning' });
  };

  if (!permission) return <ThemedView style={styles.root} />;

  if (!permission.granted) {
    return (
      <ThemedView style={styles.root}>
        <ScreenHeader title="Scan a barcode" dismissLabel="Cancel" />
        <View style={styles.centered}>
          <ThemedText type="sm" themeColor="textSecondary" style={styles.centerText}>
            Metabolizm needs the camera to scan barcodes on food packaging.
          </ThemedText>
          <Button label="Allow camera" onPress={() => void requestPermission()} />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.root}>
      <ScreenHeader title="Scan a barcode" dismissLabel="Cancel" />
      <View style={styles.cameraWrap}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
          // Detaching the handler once we have a result stops the native side
          // delivering frames we would only throw away.
          onBarcodeScanned={outcome.kind === 'scanning' ? onScanned : undefined}
        />
        <View style={[styles.reticle, { borderColor: colors.accent }]} />
      </View>

      <View style={styles.results}>
        {outcome.kind === 'scanning' ? (
          <ThemedText type="sm" themeColor="textSecondary" style={styles.centerText}>
            Point the camera at the barcode on the packet.
          </ThemedText>
        ) : outcome.kind === 'looking_up' ? (
          <ThemedText type="sm" themeColor="textSecondary" style={styles.centerText}>
            Looking up {formatGtin(outcome.code)}…
          </ThemedText>
        ) : outcome.kind === 'not_found' ? (
          <>
            {/* Framed as contribution, not failure: in this market a miss is
                the common case and the user is about to do everyone a favour. */}
            <ThemedText type="smBold">Not in the catalogue yet</ThemedText>
            <ThemedText type="sm" themeColor="textSecondary" style={styles.centerText}>
              Add it once and everyone who scans {formatGtin(outcome.code)} after
              you gets it too.
            </ThemedText>
            <Button
              label="Add this food"
              onPress={() =>
                router.replace({
                  pathname: '/create-food',
                  params: { barcode: outcome.code },
                })
              }
            />
            <Button label="Scan again" variant="ghost" size="sm" onPress={rescan} />
          </>
        ) : outcome.kind === 'store_local' ? (
          <>
            <ThemedText type="smBold">That&apos;s a store label</ThemedText>
            <ThemedText type="sm" themeColor="textSecondary" style={styles.centerText}>
              The digits encode a weight or price from the shop&apos;s own
              scales, not a product, so no database can look it up. Enter the
              food by hand instead.
            </ThemedText>
            <Button
              label="Enter it manually"
              onPress={() => router.replace('/create-food')}
            />
            <Button label="Scan again" variant="ghost" size="sm" onPress={rescan} />
          </>
        ) : outcome.kind === 'unreadable' ? (
          <ThemedText type="sm" themeColor="textSecondary" style={styles.centerText}>
            Couldn&apos;t read that one — try holding a little further back.
          </ThemedText>
        ) : (
          <>
            <ThemedText type="sm" themeColor="danger" style={styles.centerText}>
              {outcome.message}
            </ThemedText>
            <Button label="Try again" variant="secondary" size="sm" onPress={rescan} />
          </>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  cameraWrap: { flex: 1, overflow: 'hidden' },
  reticle: {
    position: 'absolute',
    left: '12%',
    right: '12%',
    top: '32%',
    bottom: '32%',
    borderWidth: 2,
    borderRadius: Radius.md,
  },
  results: {
    padding: Spacing.s24,
    gap: Spacing.s12,
    alignItems: 'center',
    minHeight: 180,
  },
  centered: { flex: 1, justifyContent: 'center', padding: Spacing.s24, gap: Spacing.s16 },
  centerText: { textAlign: 'center' },
});
