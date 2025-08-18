import { Button } from '@deco/ui/components/button.tsx';

interface PickerProps {
  question: string;
  options: Array<{
    id: string;
    label: string;
    value: string;
  }>;
  onSelect: (value: string) => void;
  disabled?: boolean;
}

export function Picker({ options, question, onSelect, disabled }: PickerProps) {
  return (
    <div className='flex flex-col gap-2'>
      <p className='text-sm text-muted-foreground'>{question}</p>
      <div className='flex flex-wrap gap-2'>
        {options.map((option) => (
          <Button
            key={option.id}
            variant='outline'
            size='sm'
            disabled={disabled}
            className='rounded-full hover:bg-primary hover:text-primary-foreground transition-colors'
            onClick={() => onSelect(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
