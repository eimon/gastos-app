import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface RecurringIconProps {
  size?: number;
  color?: string;
  showTooltip?: boolean;
  tooltipText?: string;
}

export const RecurringIcon: React.FC<RecurringIconProps> = ({ 
  size = 16, 
  color = '#666', 
  showTooltip = false,
  tooltipText = 'Este gasto se generará automáticamente cuando llegue al 100%'
}) => {
  return (
    <View style={{ position: 'relative' }}>
      <Ionicons 
        name="refresh-circle-outline" 
        size={size} 
        color={color} 
      />
      {showTooltip && (
        <View style={{
          position: 'absolute',
          top: size + 5,
          left: -50,
          backgroundColor: '#333',
          padding: 8,
          borderRadius: 4,
          minWidth: 200,
          zIndex: 1000
        }}>
          <Text style={{
            color: 'white',
            fontSize: 12,
            textAlign: 'center'
          }}>
            {tooltipText}
          </Text>
        </View>
      )}
    </View>
  );
};

export default RecurringIcon;