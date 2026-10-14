// On iPhone and Android, Alert.alert shows the phone's own pop-up, so nothing is needed here.
// The web app has no system pop-up: alert-host.web.tsx draws them instead.
export function AlertHost() {
  return null;
}
