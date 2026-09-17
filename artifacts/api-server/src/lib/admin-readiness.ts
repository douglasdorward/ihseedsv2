let ready = false;

export function setAdminAuthReady(value: boolean) {
  ready = value;
}

export function isAdminAuthReady() {
  return ready;
}