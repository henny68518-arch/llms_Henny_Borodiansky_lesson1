import { Component, ElementRef, viewChild, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, RequestModel, ResponseModel } from './ApiService';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

@Component({
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
  imports: [FormsModule],
})
export class App {
  /** היסטוריית השיחה המוצגת במסך */
  readonly messages = signal<ChatMessage[]>([]);

  /** תוכן שדה הקלט */
  readonly draft = signal('');

  /** האם ממתינים לתשובה מהשרת */
  readonly isSending = signal(false);

  /** שגיאה אחרונה, אם הייתה */
  readonly errorText = signal('');

  /** שדה הקלט — לגלילה אוטומטית ולשחזור הפוקוס */
  private readonly draftInput = viewChild<ElementRef<HTMLTextAreaElement>>('draftInput');

  constructor(private apiService: ApiService) { }

  /**
   * Enter שולח, Shift+Enter יורד שורה.
   * בזמן הקלדה עם IME (למשל עברית/סינית) מתעלמים — ה-Enter שייך לשיטת הקלט.
   */
  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) {
      return;
    }
    event.preventDefault();
    this.send();
  }

  /** התאמת גובה תיבת הקלט למספר השורות, עד תקרה */
  private resizeInput(): void {
    const el = this.draftInput()?.nativeElement;
    if (!el) {
      return;
    }
    // אחרי שהתבנית עודכנה (ריקון השדה, שורה חדשה) — מודדים מחדש
    requestAnimationFrame(() => {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    });
  }

  send(): void {
    const text = this.draft().trim();
    if (!text || this.isSending()) {
      return;
    }

    // ההיסטוריה לפני הוספת ההודעה החדשה — נשלחת לשרת כקונטקסט
    const history = this.messages()
      .filter(m => m.text.length > 0) // מדלגים על בועות ריקות
      .map(m => ({ role: m.role, content: m.text }));

    // הודעת המשתמש + הודעת "ממתין" זמנית שתתמלא בתשובה
    this.messages.update(list => [
      ...list,
      { role: 'user', text } as ChatMessage,
      { role: 'assistant', text: '' } as ChatMessage,
    ]);

    this.draft.set('');
    this.resizeInput();
    this.errorText.set('');
    this.isSending.set(true);

    const request: RequestModel = {
      model: 'gpt-4o-mini',
      // כל השיחה: מה שהיה + ההודעה הנוכחית
      messages: [...history, { role: 'user', content: text }],
    };

    this.apiService.generateContent(request).subscribe({
      next: (response: ResponseModel) => {
        // ממלאים את הבועה האחרונה (הזמנית) בתשובה שהתקבלה
        this.messages.update(list => {
          const copy = [...list];
          copy[copy.length - 1] = {
            role: 'assistant',
            text: response.output_text,
          };
          return copy;
        });
        this.isSending.set(false);
      },
      error: (error) => {
        console.error('Error:', error);
        // מסירים את הבועה הריקה ומציגים את השגיאה מתחת לשיחה
        this.messages.update(list => list.slice(0, -1));
        this.errorText.set(
          error?.error?.detail ?? error.message ?? 'שגיאה לא ידועה'
        );
        this.isSending.set(false);
      },
    });
  }

  clear(): void {
    if (this.isSending()) {
      return;
    }
    this.messages.set([]);
    this.errorText.set('');
  }

  /** משנה את תוכן שדה הקלט */
  setDraft(value: string): void {
    this.draft.set(value);
    this.resizeInput();
  }
}
