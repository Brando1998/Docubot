from typing import Dict, Text, Any, List
from rasa_sdk import Action, Tracker, FormValidationAction
from rasa_sdk.executor import CollectingDispatcher
from rasa_sdk.events import AllSlotsReset, EventType
from rasa_sdk.types import DomainDict
import requests
import json
import os

class ActionDefaultFallback(Action):
    def name(self) -> Text:
        return "action_default_fallback"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[EventType]:
        dispatcher.utter_message(template="utter_fallback")
        return []

class ActionSubmitManifiesto(Action):
    """Acción que se ejecuta cuando se completa el formulario de manifiesto."""

    def name(self) -> Text:
        return "action_submit_manifiesto"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[EventType]:

        # Obtener los datos del formulario
        flete = tracker.get_slot("flete")
        descripcion = tracker.get_slot("descripcion")
        peso = tracker.get_slot("peso")
        fecha_cargue = tracker.get_slot("fecha_cargue")
        fecha_descargue = tracker.get_slot("fecha_descargue")
        tarjeta = tracker.get_slot("tarjeta")
        licencia = tracker.get_slot("licencia")
        origen = tracker.get_slot("origen")
        destino = tracker.get_slot("destino")

        # Recopilar todas las entidades para guardar en la base de datos
        entities = {
            "flete": flete,
            "descripcion": descripcion,
            "peso": peso,
            "fecha_cargue": fecha_cargue,
            "fecha_descargue": fecha_descargue,
            "tarjeta": tarjeta,
            "licencia": licencia,
            "origen": origen,
            "destino": destino
        }

        # Log para debug (opcional)
        print(f"📋 Manifiesto solicitado:")
        print(f"  💰 Flete: {flete}")
        print(f"  📦 Descripción: {descripcion}")
        print(f"  ⚖️ Peso: {peso}")
        print(f"  📅 Fecha cargue: {fecha_cargue}")
        print(f"  📅 Fecha descargue: {fecha_descargue}")
        print(f"  🚗 Tarjeta: {tarjeta}")
        print(f"  🪪 Licencia: {licencia}")
        print(f"  📍 Origen: {origen}")
        print(f"  🎯 Destino: {destino}")

        # Aquí podrías hacer la llamada a tu API para guardar el documento
        # Por ejemplo, enviar los datos a la API de Go para almacenar
        try:
            # Simular llamada a API para guardar documento
            self.save_document_to_api(tracker.sender_id, "manifiesto", entities)
        except Exception as e:
            print(f"Error guardando documento: {e}")

        dispatcher.utter_message(
            text=f"✅ Perfecto! He recibido todos los datos para el manifiesto:\n\n"
                 f"💰 Flete: {flete}\n"
                 f"📦 Carga: {descripcion}\n"
                 f"⚖️ Peso: {peso}\n"
                 f"📅 Cargue: {fecha_cargue}\n"
                 f"📅 Descarga: {fecha_descargue}\n"
                 f"🚗 Tarjeta: {tarjeta}\n"
                 f"🪪 Licencia: {licencia}\n"
                 f"📍 Origen: {origen}\n"
                 f"🎯 Destino: {destino}\n\n"
                 f"🔄 Procesando manifiesto..."
        )

        # Limpiar los slots después de procesar
        return [AllSlotsReset()]

    def save_document_to_api(self, sender_id: str, doc_type: str, entities: dict):
        """Guarda el documento en la API de Go"""
        try:
            # Aquí iría la lógica para llamar a la API de Go
            # Por ahora solo simulamos
            print(f"📄 Guardando documento {doc_type} para sender {sender_id}")
            print(f"📊 Entidades guardadas: {entities}")
        except Exception as e:
            print(f"Error en save_document_to_api: {e}")

class ValidateManifiestoForm(FormValidationAction):
    """Validador para el formulario de manifiesto."""
    
    def name(self) -> Text:
        return "validate_manifiesto_form"

    def validate_flete(
        self,
        slot_value: Any,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: DomainDict,
    ) -> Dict[Text, Any]:
        """Valida el slot de flete."""
        if slot_value is None:
            return {"flete": None}
        
        # Limpiar el valor (remover símbolos)
        clean_value = str(slot_value).replace("$", "").replace(",", "").replace(".", "").strip()
        
        # Verificar si es numérico
        if clean_value.isdigit():
            return {"flete": clean_value}
        else:
            dispatcher.utter_message(text="❌ El flete debe ser un valor numérico. Por ejemplo: 150000 o $150,000")
            return {"flete": None}

    def validate_peso(
        self,
        slot_value: Any,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: DomainDict,
    ) -> Dict[Text, Any]:
        """Valida el slot de peso."""
        if slot_value is None:
            return {"peso": None}

        # Aceptar formato con "kg" o solo números
        clean_value = str(slot_value).lower().replace("kg", "").replace("kilos", "").strip()

        try:
            # Verificar si es numérico (puede tener decimales)
            float(clean_value)
            return {"peso": slot_value}  # Mantener formato original
        except ValueError:
            dispatcher.utter_message(text="❌ El peso debe ser un valor numérico. Por ejemplo: 500 kg o 1.5 toneladas")
            return {"peso": None}


class ActionExpedirManifiesto(Action):
    """Acción dummy para expedir manifiestos."""

    def name(self) -> Text:
        return "action_expedir_manifiesto"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[EventType]:
        # Obtener datos del tracker (puedes agregar slots específicos si es necesario)
        sender = tracker.sender_id

        # Log para debug
        print(f"📋 Expedir manifiesto solicitado por: {sender}")

        # Aquí iría la lógica real para expedir el manifiesto
        # Por ahora es dummy - solo confirma recepción

        dispatcher.utter_message(
            text="✅ Solicitud de expedición de manifiesto recibida.\n\n"
                 "🔄 Procesando expedición...\n\n"
                 "Esta funcionalidad estará disponible próximamente."
        )

        return []


class ActionRegistrarConductor(Action):
    """Acción dummy para registrar usuario conductor."""

    def name(self) -> Text:
        return "action_registrar_conductor"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[EventType]:
        sender = tracker.sender_id

        print(f"👤 Registro de conductor solicitado por: {sender}")

        dispatcher.utter_message(
            text="✅ Solicitud de registro de conductor recibida.\n\n"
                 "🔄 Procesando registro...\n\n"
                 "Esta funcionalidad estará disponible próximamente."
        )

        return []


class ActionVerificarConductor(Action):
    """Acción dummy para verificar conductor."""

    def name(self) -> Text:
        return "action_verificar_conductor"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[EventType]:
        sender = tracker.sender_id

        print(f"🔍 Verificación de conductor solicitada por: {sender}")

        dispatcher.utter_message(
            text="✅ Solicitud de verificación de conductor recibida.\n\n"
                 "🔄 Procesando verificación...\n\n"
                 "Esta funcionalidad estará disponible próximamente."
        )

        return []


class ActionGenerarPago(Action):
    """Acción dummy para generar pago."""

    def name(self) -> Text:
        return "action_generar_pago"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[EventType]:
        sender = tracker.sender_id

        print(f"💰 Generación de pago solicitada por: {sender}")

        dispatcher.utter_message(
            text="✅ Solicitud de generación de pago recibida.\n\n"
                 "🔄 Procesando pago...\n\n"
                 "Esta funcionalidad estará disponible próximamente."
        )

        return []