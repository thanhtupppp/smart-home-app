const React = require('react');

const createIcon = (name) => (props) => React.createElement(`Icon-${name}`, props);

module.exports = {
  Ionicons: createIcon('Ionicons'),
  MaterialIcons: createIcon('MaterialIcons'),
  MaterialCommunityIcons: createIcon('MaterialCommunityIcons'),
};
