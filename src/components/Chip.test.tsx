import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { ThemeProvider } from '@/theme';

import { Chip } from './Chip';

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('Chip', () => {
  it('ラベルを表示する', () => {
    renderWithTheme(<Chip label="映画" />);
    expect(screen.getByText('映画')).toBeTruthy();
  });

  it('タップするとonPressが呼ばれる', () => {
    const onPress = jest.fn();
    renderWithTheme(<Chip label="旅行" onPress={onPress} />);
    fireEvent.press(screen.getByText('旅行'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
