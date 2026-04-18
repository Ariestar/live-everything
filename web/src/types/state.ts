export type AppState =
  | 'Idle'
  | 'Detecting'
  | 'Matched'
  | 'QRCodeVisible'
  | 'InfoPanelOpen'
  | 'VoiceRecording'
  | 'VoiceProcessing'
  | 'AnswerDisplayed'
  | 'Lost';

export const STATE_LABELS: Record<AppState, string> = {
  Idle: '待识别',
  Detecting: '识别中',
  Matched: '已匹配',
  QRCodeVisible: '种草码可见',
  InfoPanelOpen: '商品详情',
  VoiceRecording: '录音中',
  VoiceProcessing: '语音处理中',
  AnswerDisplayed: '回答已展示',
  Lost: '商品丢失',
};
