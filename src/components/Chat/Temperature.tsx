import {
  FC,
  KeyboardEventHandler,
  MouseEventHandler,
  ReactNode,
  TouchEventHandler,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

import { DEFAULT_TEMPERATURE } from '@/src/constants/default-settings';

import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { HandleProps } from 'rc-slider/lib/Handles/Handle';

interface TemperatureIndicatorProps extends HandleProps {
  onKeyDown: KeyboardEventHandler<HTMLDivElement>;
  onMouseDown: MouseEventHandler<HTMLDivElement>;
  onTouchStart: TouchEventHandler<HTMLDivElement>;
  children: ReactNode;
}
const TemperatureIndicator = ({
  style,
  onKeyDown,
  onMouseDown,
  onTouchStart,
  children,
}: TemperatureIndicatorProps) => {
  return (
    <div
      className="absolute top-[calc(50%-20px)] flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-layer-3 shadow"
      style={style}
      onKeyDown={onKeyDown}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
    >
      {children}
    </div>
  );
};

interface Props {
  label: string;
  temperature: number | undefined;
  onChangeTemperature: (temperature: number) => void;
}

export const TemperatureSlider: FC<Props> = ({
  label,
  onChangeTemperature,
  temperature,
}) => {
  const [currentTemperature, setCurrentTemperature] = useState<number>(() => {
    return temperature ?? DEFAULT_TEMPERATURE;
  });
  const { t } = useTranslation(Translation.Chat);

  const handleChange = (value: number) => {
    setCurrentTemperature(value);
    onChangeTemperature(value);
  };

  return (
    <div className="flex flex-col gap-3" data-qa="temp-slider">
      <label className="text-left">{label}</label>
      <span className="text-sm text-secondary">
        {t(
          'Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic.',
        )}
      </span>
      <div className="grid h-4 w-full grid-cols-3 text-xs">
        <span className="">{t('Precise')}</span>
        <span className="text-center">{t('Neutral')}</span>
        <span className="text-right">{t('Creative')}</span>
      </div>

      <div className="px-5">
        <Slider
          className="temperature-slider !h-10"
          value={temperature}
          onChange={(value) => typeof value === 'number' && handleChange(value)}
          min={0}
          max={1}
          step={0.1}
          handleRender={({ props }) => (
            <TemperatureIndicator {...(props as TemperatureIndicatorProps)}>
              {currentTemperature}
            </TemperatureIndicator>
          )}
        />
      </div>
    </div>
  );
};
