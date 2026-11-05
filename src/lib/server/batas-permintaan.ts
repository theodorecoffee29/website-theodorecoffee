// File ini: konstanta batas permintaan (rate limit) per endpoint.

export const BATAS_PERMINTAAN = {
  ordersPerIp: { batas: 30, jendelaDetik: 60 },
  ordersGlobal: { batas: 120, jendelaDetik: 60 },
  cancelPerIp: { batas: 30, jendelaDetik: 60 },
  cancelPerOrder: { batas: 5, jendelaDetik: 60 },
  logErrorPerIp: { batas: 20, jendelaDetik: 60 },
  loginPerIp: { batas: 30, jendelaDetik: 600 },
  loginPerEmail: { batas: 8, jendelaDetik: 600 },
  // Best effort (in-memory) untuk GET anonim.
  menuPerIp: { batas: 120, jendelaDetik: 60 },
  statusPerIp: { batas: 300, jendelaDetik: 60 },
} as const;
