/**
 * Extended Item document for the FORJA system.
 */
export default class ForjaItem extends Item {

  /** @override */
  prepareData() {
    super.prepareData();
  }

  /**
   * Handle chat output for an item (e.g., posting item details to chat).
   */
  async toChat() {
    const content = `
      <div class="forja-item-chat">
        <h4>${this.name}</h4>
        <p>${this.system.description ?? this.system.notes ?? ""}</p>
      </div>
    `;
    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content
    });
  }
}
