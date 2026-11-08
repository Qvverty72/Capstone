import { Platform, Pressable, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { CONTENT_POLICY_ACCEPTANCE, CONTENT_POLICY_SECTIONS } from '../contentPolicy';
import { authStyles as styles } from './form.styles';

/** Aviso completo y aceptación explícita antes de crear una cuenta institucional. */
export function RegistrationDisclaimer({ accepted, disabled, onChange }: {
  accepted: boolean; disabled: boolean; onChange: (accepted: boolean) => void;
}) {
  return <View style={styles.policy}>
    <Text accessibilityRole="header" style={styles.policyTitle}>Responsabilidad y normas de uso</Text>
    {CONTENT_POLICY_SECTIONS.map(section => <View key={section.title} style={styles.field}>
      <Text style={styles.label}>{section.title}</Text>
      <Text style={styles.policyText}>{section.text}</Text>
    </View>)}
    <Pressable accessibilityRole="checkbox" accessibilityLabel={CONTENT_POLICY_ACCEPTANCE}
      accessibilityState={{ checked: accepted, disabled }} aria-checked={accepted} aria-disabled={disabled} disabled={disabled}
      onKeyDown={Platform.OS === 'web' ? event => {
        // RNWeb activa Enter en checkbox; Space requiere manejo explícito para este rol.
        if (event.nativeEvent.key === ' ' || event.nativeEvent.key === 'Spacebar') {
          event.preventDefault();
          if (!disabled && !event.nativeEvent.repeat) onChange(!accepted);
        }
      } : undefined}
      onPress={() => onChange(!accepted)} style={[styles.policyAcceptance, disabled && styles.disabled]}>
      <View style={[styles.policyCheckbox, accepted && styles.policyCheckboxAccepted]}>
        {accepted && <Check size={17} color="#FFFFFF" />}
      </View>
      <Text style={styles.policyAcceptanceText}>{CONTENT_POLICY_ACCEPTANCE}</Text>
    </Pressable>
  </View>;
}
