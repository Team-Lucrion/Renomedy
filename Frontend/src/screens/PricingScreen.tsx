import React, { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import { useAppData } from '../context/AppDataContext';
import type { PaymentOrder } from '../types/backend';
import { borderRadius, colors, shadows, spacing, typography } from '../theme/theme';

const plans = [
  {
    slug: 'free',
    name: 'Free',
    price: '₹0',
    cadence: 'forever',
    positioning: 'Family Care Simplified',
    cta: 'Start Free',
    features: [
      '5 prescription scans/month',
      'Basic OCR prescription decoding',
      'Medicine explanations',
      'OD/BD/TDS abbreviation explanations',
      '1 family member',
      'Basic medicine reminders',
    ],
    locked: ['Caregiver alerts', 'Refill prediction', 'Adherence history', 'Multi-member coordination', 'Premium support'],
  },
  {
    slug: 'care',
    name: 'Care',
    price: '₹199',
    yearly: '₹1,999/year',
    cadence: 'per month',
    positioning: 'Protect Your Family',
    cta: 'Protect Your Family',
    popular: true,
    features: [
      'Unlimited prescription scans',
      'Unlimited medicine reminders',
      'Caregiver alerts',
      'Refill prediction',
      'Adherence tracking/history',
      'Prescription archive',
      'Missed-dose notifications',
      'Up to 3 family members',
    ],
    locked: [],
  },
  {
    slug: 'family_plus',
    name: 'Family Plus',
    price: '₹299',
    yearly: '₹2,999/year',
    cadence: 'per month',
    positioning: 'Coordinate Full Family Care',
    cta: 'Coordinate Family Care',
    features: [
      'Everything in Care',
      'Up to 10 family members',
      'Multi-caregiver coordination',
      'NRI family management',
      'Priority support',
      'Advanced adherence insights',
      'Smart escalation alerts',
      'Early beta AI features',
    ],
    locked: [],
  },
];

function billingLabel(cycle?: string) {
  if (cycle === 'lifetime') return 'Lifetime access';
  if (cycle === 'yearly') return 'Yearly billing';
  return 'Monthly billing';
}

export default function PricingScreen() {
  const navigation = useNavigation();
  const { subscriptionSummary, createPaymentOrder, verifyPayment, checkPaymentStatus } = useAppData();
  const activePlanSlug = subscriptionSummary?.subscription?.plan_slug ?? 'free';
  const isLifetime = subscriptionSummary?.subscription?.billing_cycle === 'lifetime';
  const [selectedPlan, setSelectedPlan] = useState<typeof plans[number] | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [pendingOrder, setPendingOrder] = useState<PaymentOrder | null>(null);
  const [paymentMessage, setPaymentMessage] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const scanText = useMemo(() => {
    const used = subscriptionSummary?.usage?.prescription_scans_used ?? 0;
    const limit = subscriptionSummary?.plan?.scan_limit_monthly;
    return limit ? `${used}/${limit} scans used this month` : 'Unlimited scans active';
  }, [subscriptionSummary]);

  const beginCheckout = async () => {
    if (!selectedPlan || selectedPlan.slug === 'free') {
      return;
    }

    setIsProcessingPayment(true);
    setPaymentMessage('');
    try {
      const order = await createPaymentOrder({
        plan_slug: selectedPlan.slug as 'care' | 'family_plus',
        billing_cycle: billingCycle,
      });
      setPendingOrder(order);

      const verification = await verifyPayment({
        razorpay_order_id: order.id,
        razorpay_payment_id: `mock_payment_${Date.now()}`,
        razorpay_signature: 'mock_signature',
      });

      setPaymentMessage(
        verification.success
          ? `${selectedPlan.name} is now active for your whole sanctuary.`
          : 'Payment could not be verified.',
      );
      setSelectedPlan(null);
    } catch (paymentError) {
      setPaymentMessage(paymentError instanceof Error ? paymentError.message : 'Unable to continue to payment.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!pendingOrder) {
      return;
    }

    setIsProcessingPayment(true);
    try {
      const status = await checkPaymentStatus(pendingOrder.id);
      setPaymentMessage(
        status.captured
          ? 'Payment confirmed. Premium care is active for your sanctuary.'
          : `Payment is still ${status.status}.`,
      );
    } catch (statusError) {
      setPaymentMessage(statusError instanceof Error ? statusError.message : 'Unable to check payment status.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.menuButton} onPress={() => navigation.dispatch(DrawerActions.openDrawer())}>
          <Ionicons name="menu" size={24} color={colors.primary} />
        </TouchableOpacity>

        <View style={styles.headerBlock}>
          <Text style={styles.brand}>Renomedy</Text>
          <Text style={styles.title}>Premium Care For Your Sanctuary</Text>
          <Text style={styles.subtitle}>Unlock unlimited scans, reminders, and family continuity for everyone in your sanctuary.</Text>
        </View>

        <View style={styles.currentPlan}>
          <View>
            <Text style={styles.currentLabel}>Current plan</Text>
            <Text style={styles.currentName}>
              {subscriptionSummary?.plan?.display_name ?? 'Free'} {isLifetime ? 'Founder' : ''}
            </Text>
          </View>
          <View style={styles.currentBadge}>
            <Text style={styles.currentBadgeText}>{billingLabel(subscriptionSummary?.subscription?.billing_cycle)}</Text>
          </View>
          <Text style={styles.usageText}>{scanText}</Text>
          {paymentMessage ? <Text style={styles.paymentMessage}>{paymentMessage}</Text> : null}
          {pendingOrder ? (
            <TouchableOpacity style={styles.statusButton} onPress={() => void handleCheckStatus()} disabled={isProcessingPayment}>
              <Text style={styles.statusButtonText}>Check Payment Status</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {selectedPlan ? (
          <View style={styles.bridgeCard}>
            <Text style={styles.bridgeEyebrow}>Continue To Secure Payment</Text>
            <Text style={styles.bridgeTitle}>You&apos;re unlocking premium care for your whole Sanctuary.</Text>
            <Text style={styles.bridgeBody}>
              {selectedPlan.slug === 'care'
                ? 'Unlimited prescription scans, medicine reminders, and continuity alerts for your family.'
                : 'Everything in Care, plus multi-member coordination and higher family capacity.'}
            </Text>
            <View style={styles.cycleRow}>
              <TouchableOpacity style={[styles.cycleButton, billingCycle === 'monthly' ? styles.cycleButtonActive : null]} onPress={() => setBillingCycle('monthly')}>
                <Text style={[styles.cycleText, billingCycle === 'monthly' ? styles.cycleTextActive : null]}>Monthly</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.cycleButton, billingCycle === 'yearly' ? styles.cycleButtonActive : null]} onPress={() => setBillingCycle('yearly')}>
                <Text style={[styles.cycleText, billingCycle === 'yearly' ? styles.cycleTextActive : null]}>Yearly</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.bridgeButton} onPress={() => void beginCheckout()} disabled={isProcessingPayment}>
              {isProcessingPayment ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.bridgeButtonText}>Continue To Secure Payment</Text>}
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.planList}>
          {plans.map((plan) => {
            const isActive = activePlanSlug === plan.slug;
            const isCare = plan.slug === 'care';

            return (
              <View key={plan.slug} style={[styles.planCard, isCare ? styles.highlightedPlan : null]}>
                <View style={styles.planTop}>
                  <View>
                    <Text style={styles.planName}>{plan.name}</Text>
                    <Text style={styles.positioning}>{plan.positioning}</Text>
                  </View>
                  {plan.popular ? (
                    <View style={styles.popularBadge}>
                      <Text style={styles.popularText}>Most Popular</Text>
                    </View>
                  ) : null}
                  {isActive ? (
                    <View style={styles.activeBadge}>
                      <Text style={styles.activeText}>Active</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.priceRow}>
                  <Text style={styles.price}>{plan.price}</Text>
                  <Text style={styles.cadence}>{plan.cadence}</Text>
                </View>
                {plan.yearly ? <Text style={styles.yearly}>{plan.yearly}</Text> : null}

                <View style={styles.featureList}>
                  {plan.features.map((feature) => (
                    <View key={feature} style={styles.featureRow}>
                      <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                      <Text style={styles.featureText}>{feature}</Text>
                    </View>
                  ))}
                  {plan.locked.map((feature) => (
                    <View key={feature} style={styles.featureRow}>
                      <Ionicons name="lock-closed-outline" size={17} color={colors.textMuted} />
                      <Text style={styles.lockedText}>{feature}</Text>
                    </View>
                  ))}
                </View>

                <TouchableOpacity
                  disabled={isActive}
                  style={[styles.ctaButton, isCare ? styles.primaryCta : null, isActive ? styles.disabledCta : null]}
                  onPress={() => setSelectedPlan(plan.slug === 'free' ? null : plan)}
                >
                  <Text style={[styles.ctaText, isCare ? styles.primaryCtaText : null]}>
                    {isActive ? 'Current Plan' : plan.cta}
                  </Text>
                </TouchableOpacity>
                {!isActive ? <Text style={styles.betaNote}>One payer unlocks premium care for the whole sanctuary.</Text> : null}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContainer: {
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: 100,
    paddingTop: 52,
  },
  menuButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
    ...shadows.sm,
  },
  headerBlock: {
    gap: spacing.xs,
  },
  brand: {
    ...typography.label,
    color: colors.primary,
    letterSpacing: 0,
  },
  title: {
    ...typography.h1,
    color: colors.primary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 23,
  },
  currentPlan: {
    backgroundColor: colors.surface,
    borderColor: `${colors.secondary}70`,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
    ...shadows.sm,
  },
  currentLabel: {
    ...typography.bodySmall,
  },
  currentName: {
    ...typography.h3,
    color: colors.primary,
    marginTop: 2,
  },
  currentBadge: {
    alignSelf: 'flex-start',
    backgroundColor: `${colors.secondary}28`,
    borderRadius: borderRadius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  currentBadgeText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '700',
  },
  usageText: {
    ...typography.bodySmall,
  },
  paymentMessage: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '700',
  },
  statusButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: spacing.md,
  },
  statusButtonText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '700',
  },
  bridgeCard: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.md,
  },
  bridgeEyebrow: {
    ...typography.bodySmall,
    color: colors.secondary,
    fontWeight: '700',
  },
  bridgeTitle: {
    ...typography.h2,
    color: colors.surface,
    marginTop: spacing.sm,
  },
  bridgeBody: {
    ...typography.bodySmall,
    color: '#E6FFFA',
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  cycleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  cycleButton: {
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  cycleButtonActive: {
    backgroundColor: colors.surface,
  },
  cycleText: {
    ...typography.bodySmall,
    color: colors.surface,
    fontWeight: '700',
  },
  cycleTextActive: {
    color: colors.primary,
  },
  bridgeButton: {
    alignItems: 'center',
    backgroundColor: '#F6AD55',
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    marginTop: spacing.lg,
    minHeight: 52,
  },
  bridgeButtonText: {
    ...typography.label,
    color: colors.text,
  },
  planList: {
    gap: spacing.lg,
  },
  planCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    ...shadows.sm,
  },
  highlightedPlan: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  planTop: {
    gap: spacing.sm,
  },
  planName: {
    ...typography.h2,
    color: colors.text,
  },
  positioning: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '700',
    marginTop: 2,
  },
  popularBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  popularText: {
    ...typography.bodySmall,
    color: colors.surface,
    fontWeight: '700',
  },
  activeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: `${colors.success}18`,
    borderRadius: borderRadius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  activeText: {
    ...typography.bodySmall,
    color: colors.success,
    fontWeight: '700',
  },
  priceRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  price: {
    ...typography.h1,
    color: colors.primary,
    fontSize: 34,
  },
  cadence: {
    ...typography.bodySmall,
    marginBottom: 5,
  },
  yearly: {
    ...typography.bodySmall,
    marginTop: 2,
  },
  featureList: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  featureRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  featureText: {
    ...typography.bodySmall,
    color: colors.text,
    flex: 1,
  },
  lockedText: {
    ...typography.bodySmall,
    flex: 1,
  },
  ctaButton: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: spacing.lg,
    minHeight: 52,
  },
  primaryCta: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  disabledCta: {
    opacity: 0.72,
  },
  ctaText: {
    ...typography.label,
    color: colors.primary,
  },
  primaryCtaText: {
    color: colors.surface,
  },
  betaNote: {
    ...typography.bodySmall,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
