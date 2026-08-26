const React = require('react');

const View = (props) => React.createElement('View', props, props.children);
const Text = (props) => React.createElement('Text', props, props.children);
const TouchableOpacity = (props) => React.createElement('TouchableOpacity', props, props.children);
const Pressable = (props) => {
  const children = typeof props.children === 'function' ? props.children({ pressed: false }) : props.children;
  const style = typeof props.style === 'function' ? props.style({ pressed: false }) : props.style;
  return React.createElement('Pressable', { ...props, style }, children);
};
const ScrollView = (props) => React.createElement('ScrollView', props, props.children);
const TextInput = (props) => React.createElement('TextInput', props, props.children);
const Switch = (props) => React.createElement('Switch', props, props.children);
const Modal = (props) => React.createElement('Modal', props, props.children);
const ActivityIndicator = (props) => React.createElement('ActivityIndicator', props, props.children);
const StatusBar = (props) => React.createElement('StatusBar', props, props.children);

const StyleSheet = {
  create: (styles) => styles,
};

const Platform = {
  OS: 'ios',
  select: (objs) => objs.ios || objs.default,
};

const Animated = {
  Value: function (val) {
    this.value = val;
    this.setValue = (v) => { this.value = v; };
  },
  timing: () => ({
    start: (cb) => cb && cb(),
    stop: () => {},
  }),
  loop: (anim) => ({
    start: (cb) => cb && cb(),
    stop: () => {},
  }),
  sequence: (anims) => ({
    start: (cb) => cb && cb(),
    stop: () => {},
  }),
  View: (props) => React.createElement('Animated.View', props, props.children),
};

const Alert = {
  alert: jest.fn(),
};

module.exports = {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  ScrollView,
  TextInput,
  Switch,
  Modal,
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  Platform,
  Animated,
  Alert,
};
