import { Injectable } from '@angular/core';
   import { HttpClient } from '@angular/common/http';
   import { Observable } from 'rxjs';

   export interface ChatMessage {
     role: 'user' | 'assistant';
     content: string;
   }

   export interface RequestModel {
     model: string;
     /** כל ההיסטוריה של השיחה, לפי הסדר */
     messages: ChatMessage[];
   }

   export interface ResponseModel {
     output_text: string;
     model: string;
   }

   @Injectable({
     providedIn: 'root'
   })
   export class ApiService {
     private baseUrl = 'http://localhost:8000';

     constructor(private http: HttpClient) { }

     generateContent(request: RequestModel): Observable<ResponseModel> {
       return this.http.post<ResponseModel>(`${this.baseUrl}/generate`, request);
     }

     healthCheck(): Observable<any> {
       return this.http.get(`${this.baseUrl}/health`);
     }
   }